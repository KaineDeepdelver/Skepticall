package com.skepticall.app.common;

import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.exceptions.ErrorType;
import com.skepticall.app.group.dto.GroupMessageKeyDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Base64;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

/**
 * "Always encrypted": refuses any user-sent message that isn't end-to-end encrypted.
 *
 * <p>The server can't decrypt anything, so it can't prove a message really is ciphertext. What it
 * can do is refuse a message whose shape is wrong: no nonce, a nonce that isn't 24 bytes, content
 * too short to hold the 16-byte authentication tag, or (groups) a content key that isn't wrapped for
 * every member. That stops accidental plaintext from any client, old or new.
 *
 * <p>Call-log entries are exempt (they carry no user text). Turn the whole check off with
 * {@code messages.require-encryption=false} (env MESSAGES_REQUIRE_ENCRYPTION).
 */
@Component
public class EncryptionPolicy {

    static final int NONCE_BYTES = 24;       // NaCl box / secretbox nonce
    static final int TAG_BYTES = 16;         // Poly1305 tag: ciphertext is at least this long
    static final int WRAPPED_KEY_BYTES = 48; // 32-byte key + 16-byte tag

    @Value("${messages.require-encryption:true}")
    private boolean required;

    public boolean isRequired() {
        return required;
    }

    /** Messages that carry no user content and are therefore sent in the clear. */
    public static boolean isExempt(String type) {
        if (type == null) return false;
        String t = type.toUpperCase(Locale.ROOT);
        return t.startsWith("CALL") || t.equals("VIDEO_CALL") || t.equals("DELETE") || t.equals("EDIT");
    }

    // == Direct messages =========================================================

    public void checkDirectSend(String type, String content, String nonce,
                                String replyPreview, String replyPreviewNonce,
                                String fileUrl, String mediaNonce, String mediaKeyCiphertext, String mediaKeyNonce) {
        if (!required || isExempt(type)) return;

        if (present(content)) requireCipher("The message", content, nonce);
        if (present(replyPreview)) requireCipher("The reply preview", replyPreview, replyPreviewNonce);
        if (present(fileUrl)) {
            requireNonce("The file", mediaNonce);
            if (decodedLength(mediaKeyCiphertext) != WRAPPED_KEY_BYTES) throw notEncrypted("The file key is missing or invalid.");
            requireNonce("The file key", mediaKeyNonce);
        }
    }

    public void checkDirectEdit(String content, String nonce) {
        if (!required) return;
        requireCipher("The edited message", content, nonce);
    }

    // == Group messages ==========================================================

    public void checkGroupSend(String type, String content, String nonce,
                               String replyPreview, String replyPreviewNonce,
                               String fileUrl, String mediaNonce,
                               List<GroupMessageKeyDTO> keys, Collection<Long> memberIds) {
        if (!required || isExempt(type)) return;

        boolean needsContentKey = false;
        if (present(content)) { requireCipher("The message", content, nonce); needsContentKey = true; }
        if (present(replyPreview)) { requireCipher("The reply preview", replyPreview, replyPreviewNonce); needsContentKey = true; }
        boolean hasMedia = present(fileUrl);
        if (hasMedia) requireNonce("The file", mediaNonce);

        validateKeys(keys);
        if (needsContentKey) requireCoverage(keys, "CONTENT", memberIds);
        if (hasMedia) requireCoverage(keys, "MEDIA", memberIds);
    }

    public void checkGroupEdit(String content, String nonce, List<GroupMessageKeyDTO> keys, Collection<Long> memberIds) {
        if (!required) return;
        requireCipher("The edited message", content, nonce);
        validateKeys(keys);
        requireCoverage(keys, "CONTENT", memberIds);
    }

    // == helpers =================================================================

    private static boolean present(String s) {
        return s != null && !s.isBlank();
    }

    private static BusinessException notEncrypted(String detail) {
        return new BusinessException(ErrorType.INVALID_OPERATION,
                "Messages must be end-to-end encrypted. " + detail);
    }

    /** Base64 (standard or URL-safe) length in bytes, or -1 if it isn't valid base64. */
    static int decodedLength(String s) {
        if (s == null || s.isBlank()) return -1;
        try {
            return Base64.getDecoder().decode(s.trim()).length;
        } catch (IllegalArgumentException standardFailed) {
            try {
                return Base64.getUrlDecoder().decode(s.trim()).length;
            } catch (IllegalArgumentException notBase64) {
                return -1;
            }
        }
    }

    private static void requireNonce(String what, String nonce) {
        if (decodedLength(nonce) != NONCE_BYTES) throw notEncrypted(what + " has a missing or invalid nonce.");
    }

    private static void requireCipher(String what, String data, String nonce) {
        requireNonce(what, nonce);
        if (decodedLength(data) < TAG_BYTES) throw notEncrypted(what + " is not valid ciphertext.");
    }

    private static void validateKeys(List<GroupMessageKeyDTO> keys) {
        if (keys == null) return;
        for (GroupMessageKeyDTO k : keys) {
            String t = k.getKeyType();
            if (k.getRecipientId() == null || !("CONTENT".equals(t) || "MEDIA".equals(t))
                    || decodedLength(k.getWrappedKey()) != WRAPPED_KEY_BYTES
                    || decodedLength(k.getWrappedKeyNonce()) != NONCE_BYTES) {
                throw notEncrypted("A member key is missing or invalid.");
            }
        }
    }

    /** Every current member (the sender included) must have a wrapped key, or they couldn't read it. */
    private static void requireCoverage(List<GroupMessageKeyDTO> keys, String keyType, Collection<Long> memberIds) {
        for (Long memberId : memberIds) {
            boolean covered = keys != null && keys.stream()
                    .anyMatch(k -> memberId.equals(k.getRecipientId()) && keyType.equals(k.getKeyType()));
            if (!covered) {
                throw notEncrypted("It must be encrypted for every member of the group.");
            }
        }
    }
}
