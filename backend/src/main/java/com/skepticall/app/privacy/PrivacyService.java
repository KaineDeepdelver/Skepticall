package com.skepticall.app.privacy;

import com.skepticall.app.common.ComplianceProperties;
import com.skepticall.app.config.jwt.JwtUtil;
import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.exceptions.ErrorType;
import com.skepticall.app.user.entity.User;
import com.skepticall.app.user.repository.UserRepository;
import com.skepticall.app.verification.service.EmailService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Privacy requests that don't need the person to be logged in:
 *  - "delete my data": an emailed confirmation link (for people who can't sign in)
 *  - "stop these emails": the one-click link in alert emails
 */
@Service
@RequiredArgsConstructor
public class PrivacyService {

    private static final Logger LOG = LoggerFactory.getLogger(PrivacyService.class);
    private static final long DELETE_LINK_TTL_MS = 60L * 60 * 1000;
    private static final Duration REQUEST_COOLDOWN = Duration.ofMinutes(5);

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final EmailService emailService;
    private final AccountErasureService erasureService;
    private final ComplianceProperties compliance;
    private final StringRedisTemplate redis;

    /**
     * Sends a deletion-confirmation link if an account uses this email. Always returns normally,
     * so the answer never reveals whether an address has an account. At most one email per address
     * every few minutes.
     */
    public void requestDeletion(String email) {
        if (email == null || email.isBlank()) return;
        String address = email.trim();
        if (!allowedNow(address)) return;

        Optional<User> found = userRepository.findByEmail(address);
        if (found.isEmpty() && !address.equals(address.toLowerCase(Locale.ROOT))) {
            found = userRepository.findByEmail(address.toLowerCase(Locale.ROOT));
        }
        if (found.isEmpty()) return;

        User user = found.get();
        String token = jwtUtil.generatePurpose(user.getId(), JwtUtil.PURPOSE_DELETE_ACCOUNT,
                JwtUtil.passwordTag(user.getPassword()), DELETE_LINK_TTL_MS);
        String link = compliance.frontendBaseUrl() + "/data-deletion/confirm?token=" + token;
        try {
            emailService.sendCustomEmail(user.getEmail(), "Confirm deleting your Skepticall account",
                    "<h2>Delete your account?</h2>"
                    + "<p>Someone asked us to delete the Skepticall account that uses this email address and everything in it: "
                    + "your profile, messages, groups, friends and files. This can't be undone.</p>"
                    + "<p><a href=\"" + link + "\">Yes, permanently delete my account</a></p>"
                    + "<p>The link works for 1 hour. If you didn't ask for this, ignore this email and nothing will happen.</p>");
        } catch (Exception e) {
            LOG.warn("[privacy] could not send deletion email: {}", e.toString());
        }
    }

    /** Deletes the account the (still valid) link was made for. */
    @CacheEvict(value = "users", allEntries = true)
    public void confirmDeletion(String token) {
        User user = userFor(token, JwtUtil.PURPOSE_DELETE_ACCOUNT, "This deletion link is invalid or has expired");
        List<String> files = erasureService.erase(user.getId());
        erasureService.deleteFiles(files);
        LOG.info("[privacy] account {} deleted through an emailed link", user.getId());
    }

    /** Turns off the optional sign-in alert emails for the account the link was made for. */
    @CacheEvict(value = "users", allEntries = true)
    public void unsubscribeAlerts(String token) {
        User user = userFor(token, JwtUtil.PURPOSE_ALERTS_OFF, "This link is invalid or has expired");
        user.setIpLoginAlerts(false);
        userRepository.save(user);
    }

    private User userFor(String token, String purpose, String error) {
        Claims claims = token == null ? null : jwtUtil.parsePurpose(token, purpose);
        if (claims == null) throw new BusinessException(ErrorType.INVALID_OPERATION, error);
        User user = userRepository.findById(Long.parseLong(claims.getSubject()))
                .orElseThrow(() -> new BusinessException(ErrorType.INVALID_OPERATION, error));
        // A changed or reset password makes older links useless
        if (!JwtUtil.passwordTag(user.getPassword()).equals(claims.get("pw", String.class))) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, error);
        }
        return user;
    }

    private boolean allowedNow(String address) {
        try {
            Boolean first = redis.opsForValue().setIfAbsent("deletion-request:" + address.toLowerCase(Locale.ROOT), "1", REQUEST_COOLDOWN);
            return Boolean.TRUE.equals(first);
        } catch (Exception e) {
            return true; // if Redis is down, don't block the person's request
        }
    }
}
