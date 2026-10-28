package com.skepticall.app.user.service;

import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.exceptions.ErrorType;
import com.skepticall.app.user.dto.KeyVaultDTO;
import com.skepticall.app.user.entity.User;
import com.skepticall.app.user.entity.UserKeyVault;
import com.skepticall.app.user.repository.UserKeyVaultRepository;
import com.skepticall.app.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Base64;

/**
 * Stores the account's passphrase-protected key backup (see {@link UserKeyVault}).
 *
 * <p>Saving and deleting need the account password, like rerolling the public key: a stolen session
 * alone must not be able to overwrite or remove the backup a person would use to recover their
 * messages. Reading needs only a login, because the blob is useless without the recovery phrase and
 * a new device has to read it before the person can unlock anything.
 */
@Service
@RequiredArgsConstructor
public class KeyVaultService {

    /** A backup of a key ring is a few hundred bytes; this leaves room and still rejects junk. */
    static final int MAX_BLOB_CHARS = 16_384;
    static final int MIN_BLOB_BYTES = 32;

    private final UserRepository userRepository;
    private final UserKeyVaultRepository vaultRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public KeyVaultDTO get(Long userId) {
        return vaultRepository.findByUserId(userId)
                .map(KeyVaultService::toDto)
                .orElseGet(() -> KeyVaultDTO.builder().exists(false).build());
    }

    /**
     * Saves (or replaces) the backup. {@code currentPublicKey} must be the account's current key:
     * a backup that does not hold the current key could not unlock new messages.
     */
    @Transactional
    public KeyVaultDTO save(Long userId, String blob, String currentPublicKey, String password) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User profile not found [id=" + userId + "]"));
        checkPassword(user, password);

        String cleanBlob = validateBlob(blob);
        String key = PublicKeyService.canonicalize(currentPublicKey);
        if (!key.equals(user.getPublicKey())) {
            throw invalid("The backup must be made with your current key");
        }

        UserKeyVault vault = vaultRepository.findByUserId(userId)
                .orElseGet(() -> UserKeyVault.builder().userId(userId).build());
        vault.setBlob(cleanBlob);
        vault.setCurrentPublicKey(key);
        vault.setUpdatedAt(LocalDateTime.now());
        return toDto(vaultRepository.save(vault));
    }

    @Transactional
    public void delete(Long userId, String password) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User profile not found [id=" + userId + "]"));
        checkPassword(user, password);
        vaultRepository.findByUserId(userId).ifPresent(vaultRepository::delete);
    }

    // == helpers =================================================================

    /** Accepts only well-formed standard base64 of a plausible size; returns it trimmed. */
    static String validateBlob(String blob) {
        if (blob == null || blob.isBlank()) {
            throw invalid("The backup is empty");
        }
        String s = blob.trim();
        if (s.length() > MAX_BLOB_CHARS) {
            throw invalid("The backup is too large");
        }
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(s);
        } catch (IllegalArgumentException notBase64) {
            throw invalid("The backup is not valid base64");
        }
        if (raw.length < MIN_BLOB_BYTES) {
            throw invalid("The backup is too small to be a key backup");
        }
        return s;
    }

    private void checkPassword(User user, String password) {
        if (password == null || !passwordEncoder.matches(password, user.getPassword())) {
            throw invalid("Password is incorrect");
        }
    }

    private static KeyVaultDTO toDto(UserKeyVault v) {
        return KeyVaultDTO.builder()
                .exists(true)
                .blob(v.getBlob())
                .currentPublicKey(v.getCurrentPublicKey())
                .updatedAt(v.getUpdatedAt())
                .build();
    }

    private static BusinessException invalid(String message) {
        return new BusinessException(ErrorType.INVALID_OPERATION, message);
    }
}
