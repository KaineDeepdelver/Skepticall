package com.skepticall.app.verification.service;

import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.exceptions.ErrorType;
import com.skepticall.app.user.repository.UserRepository;
import com.skepticall.app.verification.entity.VerificationCode;
import com.skepticall.app.verification.repository.VerificationCodeRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.xbill.DNS.Lookup;
import org.xbill.DNS.Record;
import org.xbill.DNS.Type;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Six-digit email codes for sign-up and password reset.
 *
 * <ul>
 *   <li>Codes come from a cryptographically secure random generator and last 10 minutes.</li>
 *   <li>Only 5 wrong guesses are allowed per code, then it is dead: 6 digits would otherwise be
 *       guessable in the 10 minutes it is valid (and a guessed reset code is an account takeover).</li>
 *   <li>A new code can be requested once a minute per address, so the form can't be used to flood inboxes.</li>
 *   <li>Password-reset emails are only sent to addresses that have an account, and the answer is the same
 *       either way, so the form doesn't reveal who has an account.</li>
 *   <li>Registration requires a verified code: checked here, by the server, not just by the sign-up page.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class VerificationService {

    static final int MAX_ATTEMPTS = 5;
    static final int RESEND_COOLDOWN_SECONDS = 60;
    static final int CODE_LIFETIME_MINUTES = 10;
    /** After the email is verified, the person has this long to finish creating the account. */
    static final int VERIFIED_VALID_MINUTES = 30;

    private final VerificationCodeRepository codeRepository;
    private final EmailService emailService;
    private final UserRepository userRepository;

    @Value("${verification.require-registration:true}")
    private boolean requireRegistrationVerification;

    private final SecureRandom random = new SecureRandom();

    public boolean isValidEmailDomain(String email) {
        try {
            String domain = email.substring(email.indexOf('@') + 1);
            Record[] records = new Lookup(domain, Type.MX).run();
            return records != null && records.length > 0;
        } catch (Exception e) {
            return false;
        }
    }

    @Transactional
    public void sendRegistrationCode(String email) {
        if (!isValidEmailDomain(email)) {
            throw new BusinessException(ErrorType.INVALID_OPERATION,
                    "Registration blocked: Email domain does not exist or is invalid [email=" + email + "]");
        }
        sendCode(email, VerificationCode.CodeType.REGISTRATION);
    }

    @Transactional
    public void sendForgotPasswordCode(String email) {
        if (!isValidEmailDomain(email)) {
            throw new BusinessException(ErrorType.INVALID_OPERATION,
                    "Password reset blocked: Email domain does not exist or is invalid [email=" + email + "]");
        }
        // No account, no email, and the same answer as for a real account: nobody can use this
        // form to find out who is registered, or to send reset emails to strangers.
        if (userRepository.findByEmail(email).isEmpty()) {
            return;
        }
        sendCode(email, VerificationCode.CodeType.FORGOT_PASSWORD);
    }

    private void sendCode(String email, VerificationCode.CodeType type) {
        LocalDateTime now = LocalDateTime.now();
        Optional<VerificationCode> previous = codeRepository.findLatestCode(email, type);
        if (previous.isPresent()) {
            LocalDateTime sentAt = previous.get().getExpiresAt().minusMinutes(CODE_LIFETIME_MINUTES);
            if (sentAt.plusSeconds(RESEND_COOLDOWN_SECONDS).isAfter(now)) {
                throw new BusinessException(ErrorType.INVALID_OPERATION,
                        "Please wait a minute before asking for another code");
            }
        }

        codeRepository.deleteAllByEmail(email);
        String code = String.format("%06d", random.nextInt(1_000_000));
        codeRepository.save(VerificationCode.builder()
                .email(email)
                .code(code)
                .type(type)
                .expiresAt(now.plusMinutes(CODE_LIFETIME_MINUTES))
                .used(false)
                .attempts(0)
                .build());
        emailService.sendVerificationCode(email, code, type == VerificationCode.CodeType.FORGOT_PASSWORD);
    }

    /**
     * Checks a code. Deliberately NOT transactional: a wrong guess must be counted even though the
     * method then throws, and a rolled-back transaction would forget the guess.
     */
    public boolean verifyCode(String email, String code, VerificationCode.CodeType type) {
        VerificationCode vc = codeRepository.findLatestCode(email, type)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND,
                        "No verification code records found [email=" + email + "]"));

        if (vc.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "Verification code has expired");
        }
        if (vc.getAttempts() >= MAX_ATTEMPTS) {
            throw tooManyAttempts();
        }
        if (!sameCode(vc.getCode(), code)) {
            vc.setAttempts(vc.getAttempts() + 1);
            codeRepository.save(vc);
            if (vc.getAttempts() >= MAX_ATTEMPTS) throw tooManyAttempts();
            throw new BusinessException(ErrorType.INVALID_OPERATION, "Invalid verification code entered");
        }

        vc.setUsed(true);
        if (type == VerificationCode.CodeType.REGISTRATION) {
            // keep it around (as "verified") long enough to finish creating the account
            vc.setExpiresAt(LocalDateTime.now().plusMinutes(VERIFIED_VALID_MINUTES));
        }
        codeRepository.save(vc);
        return true;
    }

    /** Throws unless this email has a verified, still-valid sign-up code. Skipped if turned off in config. */
    public void requireVerifiedRegistration(String email) {
        if (!requireRegistrationVerification) return;
        boolean verified = email != null && codeRepository
                .findVerified(email, VerificationCode.CodeType.REGISTRATION, LocalDateTime.now()).isPresent();
        if (!verified) {
            throw new BusinessException(ErrorType.INVALID_OPERATION,
                    "Please verify your email address with the code we sent you before creating the account");
        }
    }

    /** Forgets the sign-up code once the account exists, so it can't be used to register again. */
    @Transactional
    public void consumeRegistration(String email) {
        codeRepository.deleteAllByEmail(email);
    }

    private static BusinessException tooManyAttempts() {
        return new BusinessException(ErrorType.INVALID_OPERATION,
                "Too many incorrect attempts. Please request a new code");
    }

    /** Compares in constant time, so the response time doesn't leak how many digits were right. */
    private static boolean sameCode(String expected, String given) {
        if (expected == null || given == null) return false;
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), given.trim().getBytes(StandardCharsets.UTF_8));
    }
}
