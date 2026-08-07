package net.omnimedia.omni.group.dto;
import lombok.*;
import java.time.LocalDateTime;
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
}
