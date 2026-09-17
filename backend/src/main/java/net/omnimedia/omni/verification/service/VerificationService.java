package net.omnimedia.omni.verification.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.verification.entity.VerificationCode;
import net.omnimedia.omni.verification.repository.VerificationCodeRepository;
import org.springframework.stereotype.Service;
import org.xbill.DNS.*;
import org.xbill.DNS.Record;

import java.time.LocalDateTime;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class VerificationService {

    private final VerificationCodeRepository codeRepository;
    private final EmailService emailService;

    // == Validation ===========================================================

    public boolean isValidEmailDomain(String email) {
        try {
            String domain  = email.substring(email.indexOf('@') + 1);
            Record[] records = new Lookup(domain, Type.MX).run();
            return records != null && records.length > 0;
        } catch (Exception e) {
            return false;
        }
    }

    // == Send =================================================================

    @Transactional
    public void sendRegistrationCode(String email) {
        if (!isValidEmailDomain(email)) {
            throw new BusinessException(
                    ErrorType.INVALID_OPERATION,
                    "Registration blocked: Email domain does not exist or is invalid [email=" + email + "]"
            );
        }
        sendCode(email, VerificationCode.CodeType.REGISTRATION);
    }

    @Transactional
    public void sendForgotPasswordCode(String email) {
        if (!isValidEmailDomain(email)) {
            throw new BusinessException(
                    ErrorType.INVALID_OPERATION,
                    "Password reset blocked: Email domain does not exist or is invalid [email=" + email + "]"
            );
        }
        sendCode(email, VerificationCode.CodeType.FORGOT_PASSWORD);
    }

    private void sendCode(String email, VerificationCode.CodeType type) {
        codeRepository.deleteAllByEmail(email);

        String code = String.format("%06d", new Random().nextInt(999999));

        codeRepository.save(VerificationCode.builder()
                .email(email)
                .code(code)
                .type(type)
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .used(false)
                .build());

        emailService.sendVerificationCode(email, code,
                type == VerificationCode.CodeType.FORGOT_PASSWORD);
    }

    // == Verify ===============================================================

    public boolean verifyCode(String email, String code, VerificationCode.CodeType type) {
        return codeRepository.findLatestCode(email, type)
                .map(vc -> {
                    if (vc.getExpiresAt().isBefore(LocalDateTime.now())) {
                        throw new BusinessException(ErrorType.INVALID_OPERATION, "Verification code has expired");
                    }
                    if (!vc.getCode().equals(code)) {
                        throw new BusinessException(ErrorType.INVALID_OPERATION, "Invalid verification code entered");
                    }
                    vc.setUsed(true);
                    codeRepository.save(vc);
                    return true;
                })
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "No verification code records found [email=" + email + "]"));
    }

}