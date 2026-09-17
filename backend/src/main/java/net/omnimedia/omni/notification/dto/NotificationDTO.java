package net.omnimedia.omni.notification.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class NotificationDTO {
    private Long   id;
    private String type;
    private Long   refId;
    private String refSlug;
    private String preview;
    private String text;        // human-readable inbox sentence
    private boolean read;
    private LocalDateTime createdAt;

    private Long   actorId;
    private String actorUsername;
    private String actorDisplayName;
    private String actorAvatar;
}
