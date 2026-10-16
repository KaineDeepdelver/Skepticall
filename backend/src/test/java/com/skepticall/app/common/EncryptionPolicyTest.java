package com.skepticall.app.common;

import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.group.dto.GroupMessageKeyDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** "Always encrypted": what the server accepts and what it refuses. */
class EncryptionPolicyTest {

    private EncryptionPolicy policy;

    @BeforeEach
    void setUp() {
        policy = new EncryptionPolicy();
        ReflectionTestUtils.setField(policy, "required", true);
    }

    private static String bytes(int n) {
        byte[] raw = new byte[n];
        Arrays.fill(raw, (byte) 7);
        return Base64.getEncoder().encodeToString(raw);
    }

    private static final String NONCE = bytes(24);
    private static final String CIPHER = bytes(40); // text + 16-byte tag

    private static GroupMessageKeyDTO key(long recipient, String type) {
        return GroupMessageKeyDTO.builder().recipientId(recipient).keyType(type)
                .wrappedKey(bytes(48)).wrappedKeyNonce(bytes(24)).build();
    }

    private void directSend(String type, String content, String nonce) {
        policy.checkDirectSend(type, content, nonce, null, null, null, null, null, null);
    }

    // == Direct messages =========================================================

    @Test
    void anEncryptedTextMessageIsAccepted() {
        assertDoesNotThrow(() -> directSend("TEXT", CIPHER, NONCE));
    }

    @Test
    void plainTextIsRefused() {
        assertThrows(BusinessException.class, () -> directSend("TEXT", "hello there", null));
    }

    @Test
    void plainTextWithAFakeNonceIsStillRefused() {
        // "hello there" is not valid base64 / not tag-sized ciphertext
        assertThrows(BusinessException.class, () -> directSend("TEXT", "hello there", NONCE));
        assertThrows(BusinessException.class, () -> directSend("TEXT", bytes(8), NONCE)); // shorter than the tag
    }

    @Test
    void aWrongSizedNonceIsRefused() {
        assertThrows(BusinessException.class, () -> directSend("TEXT", CIPHER, bytes(12)));
        assertThrows(BusinessException.class, () -> directSend("TEXT", CIPHER, ""));
    }

    @Test
    void selfDestructMessagesMustBeEncryptedToo() {
        assertThrows(BusinessException.class, () -> directSend("TEMPO", "boom", null));
        assertDoesNotThrow(() -> directSend("TEMPO", CIPHER, NONCE));
    }

    @Test
    void aFileNeedsItsNonceAndAWrappedKey() {
        assertThrows(BusinessException.class, () ->
                policy.checkDirectSend("IMAGE", null, null, null, null, "https://r2/x.jpg", null, null, null));
        assertThrows(BusinessException.class, () ->
                policy.checkDirectSend("IMAGE", null, null, null, null, "https://r2/x.jpg", NONCE, bytes(10), NONCE));
        assertDoesNotThrow(() ->
                policy.checkDirectSend("IMAGE", null, null, null, null, "https://r2/x.jpg", NONCE, bytes(48), NONCE));
    }

    @Test
    void aReplyPreviewMustBeEncryptedToo() {
        assertThrows(BusinessException.class, () ->
                policy.checkDirectSend("TEXT", CIPHER, NONCE, "quoted text", null, null, null, null, null));
        assertDoesNotThrow(() ->
                policy.checkDirectSend("TEXT", CIPHER, NONCE, CIPHER, NONCE, null, null, null, null));
    }

    @Test
    void callLogsAreExempt() {
        assertDoesNotThrow(() -> directSend("CALL", "Voice call", null));
        assertDoesNotThrow(() -> directSend("VIDEO_CALL", null, null));
    }

    @Test
    void editsMustBeEncrypted() {
        assertThrows(BusinessException.class, () -> policy.checkDirectEdit("fixed", null));
        assertDoesNotThrow(() -> policy.checkDirectEdit(CIPHER, NONCE));
    }

    @Test
    void theCheckCanBeSwitchedOff() {
        ReflectionTestUtils.setField(policy, "required", false);

        assertDoesNotThrow(() -> directSend("TEXT", "plain", null));
        assertDoesNotThrow(() -> policy.checkDirectEdit("plain", null));
    }

    // == Groups ==================================================================

    private void groupSend(List<GroupMessageKeyDTO> keys, List<Long> members) {
        policy.checkGroupSend("TEXT", CIPHER, NONCE, null, null, null, null, keys, members);
    }

    @Test
    void aGroupMessageMustBeWrappedForEveryMember() {
        List<GroupMessageKeyDTO> all = List.of(key(1, "CONTENT"), key(2, "CONTENT"), key(3, "CONTENT"));

        assertDoesNotThrow(() -> groupSend(all, List.of(1L, 2L, 3L)));
        assertThrows(BusinessException.class, () -> groupSend(all.subList(0, 2), List.of(1L, 2L, 3L)));
        assertThrows(BusinessException.class, () -> groupSend(null, List.of(1L, 2L)));
        assertThrows(BusinessException.class, () -> groupSend(new ArrayList<>(), List.of(1L, 2L)));
    }

    @Test
    void aMediaKeyDoesNotCountAsAContentKey() {
        assertThrows(BusinessException.class, () -> groupSend(List.of(key(1, "MEDIA"), key(2, "MEDIA")), List.of(1L, 2L)));
    }

    @Test
    void groupFilesNeedAMediaKeyForEveryMember() {
        List<Long> members = List.of(1L, 2L);

        assertDoesNotThrow(() -> policy.checkGroupSend("IMAGE", null, null, null, null, "https://r2/x", NONCE,
                List.of(key(1, "MEDIA"), key(2, "MEDIA")), members));
        assertThrows(BusinessException.class, () -> policy.checkGroupSend("IMAGE", null, null, null, null, "https://r2/x", NONCE,
                List.of(key(1, "MEDIA")), members));
        assertThrows(BusinessException.class, () -> policy.checkGroupSend("IMAGE", null, null, null, null, "https://r2/x", null,
                List.of(key(1, "MEDIA"), key(2, "MEDIA")), members));
    }

    @Test
    void malformedWrappedKeysAreRefused() {
        GroupMessageKeyDTO bad = GroupMessageKeyDTO.builder().recipientId(1L).keyType("CONTENT")
                .wrappedKey("short").wrappedKeyNonce(bytes(24)).build();

        assertThrows(BusinessException.class, () -> groupSend(List.of(bad), List.of(1L)));
    }

    @Test
    void groupEditsNeedFreshKeysForEveryMember() {
        assertDoesNotThrow(() -> policy.checkGroupEdit(CIPHER, NONCE, List.of(key(1, "CONTENT"), key(2, "CONTENT")), List.of(1L, 2L)));
        assertThrows(BusinessException.class, () -> policy.checkGroupEdit("plain", null, null, List.of(1L)));
        assertThrows(BusinessException.class, () -> policy.checkGroupEdit(CIPHER, NONCE, List.of(key(1, "CONTENT")), List.of(1L, 2L)));
    }
}
