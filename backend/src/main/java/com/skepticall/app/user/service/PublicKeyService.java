package com.skepticall.app.user.service;

import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.exceptions.ErrorType;
import com.skepticall.app.user.dto.PublicKeyDTO;
import com.skepticall.app.user.entity.User;
import com.skepticall.app.user.entity.UserPublicKey;
import com.skepticall.app.user.repository.UserPublicKeyRepository;
import com.skepticall.app.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

/**
 * Rerolling an account's E2EE public key.
 *
 * <p>A new key becomes the account's current key immediately. The old key is NOT thrown away: it
 * stays valid for {@code keys.retired-grace-days} (default 30). That window exists because
 * messages can be encrypted to an old key after the owner rerolled: a sender may hold a stale
 * cached key, and a message queued for an offline recipient can wait up to
 * {@code messages.purge.max-pending-days} (30). Keep this value >= that one, otherwise queued
 * messages could outlive the key needed to open them.
 *
 * <p>Clients keep the matching old private keys until the key expires, and use
 * {@link #validKeys(Long)} to learn which keys (their own, and their contacts') are still valid.
 */
@Service
@RequiredArgsConstructor
public class PublicKeyService {

    private static final int KEY_BYTES = 32; // X25519

    private final UserRepository userRepository;
    private final UserPublicKeyRepository keyRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${keys.retired-grace-days:30}")
    private int graceDays;

    @Value("${keys.rotation.min-interval-minutes:60}")
    private int minIntervalMinutes;

    /** Replaced in tests to move time. */
    private Clock clock = Clock.systemDefaultZone();

    // == Key validation ==========================================================

    /**
     * Validates a client-supplied public key and returns its canonical form (standard padded
     * base64 of exactly 32 bytes). Accepts URL-safe base64 as well.
     */
    public static String canonicalize(String base64) {
        if (base64 == null || base64.isBlank()) {
            throw invalid("A public key is required");
        }
        byte[] raw = decode(base64.trim());
        if (raw.length != KEY_BYTES) {
            throw invalid("A public key must be a 32-byte X25519 key");
        }
        boolean allZero = true;
        for (byte b : raw) {
            if (b != 0) {
                allZero = false;
                break;
            }
        }
        if (allZero) {
            throw invalid("That is not a valid public key");
        }
        return Base64.getEncoder().encodeToString(raw);
    }

    private static byte[] decode(String s) {
        try {
            return Base64.getDecoder().decode(s);
        } catch (IllegalArgumentException notStandard) {
            try {
                return Base64.getUrlDecoder().decode(s);
            } catch (IllegalArgumentException notUrlSafe) {
                throw invalid("The public key is not valid base64");
            }
        }
    }

    private static BusinessException invalid(String message) {
        return new BusinessException(ErrorType.INVALID_OPERATION, message);
    }

    // == Rotation ================================================================

    /** Called at registration so the first key is part of the account's history. */
    @Transactional
    public void recordInitialKey(Long userId, String canonicalKey) {
        if (keyRepository.existsByUserIdAndPublicKey(userId, canonicalKey)) return;
        keyRepository.save(UserPublicKey.builder()
                .userId(userId)
                .publicKey(canonicalKey)
                .activatedAt(now())
                .build());
    }

    /**
     * Makes {@code newPublicKey} the account's current key. The previous key is retired but stays
     * valid for the grace period. Requires the account password: a stolen session alone must not
     * be able to swap the key that incoming messages are encrypted to.
     *
     * <p>For an account that has no key yet (created before E2EE) this simply sets the first key.
     *
     * @return the keys that are valid after the change (current first)
     */
    @Transactional
    @CacheEvict(value = "users", key = "#userId")
    public List<PublicKeyDTO> rotate(Long userId, String newPublicKey, String password) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User profile not found [id=" + userId + "]"));

        if (password == null || !passwordEncoder.matches(password, user.getPassword())) {
            throw invalid("Password is incorrect");
        }

        String newKey = canonicalize(newPublicKey);
        LocalDateTime now = now();

        UserPublicKey current = currentRow(user, now);
        if (current != null) {
            if (current.getPublicKey().equals(newKey)) {
                throw invalid("That is already your current key");
            }
            if (current.getActivatedAt().plusMinutes(minIntervalMinutes).isAfter(now)) {
                throw invalid("Your key was changed recently. You can reroll it again in a little while.");
            }
        }
        if (keyRepository.existsByUserIdAndPublicKey(userId, newKey)) {
            throw invalid("That key was used before. Generate a new one.");
        }

        if (current != null) {
            current.setRetiredAt(now);
            keyRepository.save(current);
        }
        keyRepository.save(UserPublicKey.builder()
                .userId(userId)
                .publicKey(newKey)
                .activatedAt(now)
                .build());

        user.setPublicKey(newKey);
        userRepository.save(user);

        return validKeys(userId);
    }

    /** The account's current key row; accounts that predate key history get theirs recorded here. */
    private UserPublicKey currentRow(User user, LocalDateTime now) {
        Optional<UserPublicKey> row = keyRepository
                .findFirstByUserIdAndRetiredAtIsNullOrderByCreatedAtDesc(user.getId());
        if (row.isPresent()) return row.get();
        if (user.getPublicKey() == null) return null; // the account never had a key

        LocalDateTime since = user.getCreatedAt() != null
                ? user.getCreatedAt()
                : now.minusMinutes(minIntervalMinutes + 1L);
        return keyRepository.save(UserPublicKey.builder()
                .userId(user.getId())
                .publicKey(user.getPublicKey())
                .activatedAt(since)
                .build());
    }

    // == Queries =================================================================

    /** The account's current key plus its retired keys that are still inside the grace period, current first. */
    @Transactional(readOnly = true)
    public List<PublicKeyDTO> validKeys(Long userId) {
        List<UserPublicKey> rows = keyRepository.findValid(userId, now().minusDays(graceDays));
        if (!rows.isEmpty()) {
            return rows.stream().map(this::toDto).toList();
        }

        // Account that has never rerolled: its key only lives on the user row.
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User profile not found [id=" + userId + "]"));
        if (user.getPublicKey() == null) return List.of();
        return List.of(PublicKeyDTO.builder()
                .publicKey(user.getPublicKey())
                .current(true)
                .activatedAt(user.getCreatedAt())
                .build());
    }

    private PublicKeyDTO toDto(UserPublicKey k) {
        return PublicKeyDTO.builder()
                .publicKey(k.getPublicKey())
                .current(k.getRetiredAt() == null)
                .activatedAt(k.getActivatedAt())
                .retiredAt(k.getRetiredAt())
                .expiresAt(k.getRetiredAt() == null ? null : k.getRetiredAt().plusDays(graceDays))
                .build();
    }

    // == Cleanup =================================================================

    /** Deletes retired keys whose grace period is over. Returns how many were removed. */
    @Transactional
    public int purgeExpired() {
        return keyRepository.deleteExpired(now().minusDays(graceDays));
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }
}
