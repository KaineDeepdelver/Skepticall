package net.omnimedia.omni.group.dto;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GroupMessageDTO {
    private Long id;
    private Long groupId;
    private Long senderId;
    private String senderUsername;
    private String senderDisplayName;
    private String senderAvatar;
    private String content;
    private String type;
    private String fileUrl;
    private Boolean edited;
    private String status;
    private LocalDateTime createdAt;
    private String _tmpId;
    private Long   replyToId;
    private String replyPreview;
    private String replyPreviewSender;
    private String callId;
    private String callStatus;

    // E2E encryption — see GroupMessage.java / GroupMessageKey.java.
    private String nonce;
    private String replyPreviewNonce;
    private String mediaNonce;
    // Every member's wrapped key for this message, both CONTENT and
    // (if there's a file) MEDIA — the client filters this down to its
    // own recipientId. Empty/omitted for a plaintext message (legacy, or
    // sent before any member had a public key).
    private List<GroupMessageKeyDTO> recipientKeys;
}
