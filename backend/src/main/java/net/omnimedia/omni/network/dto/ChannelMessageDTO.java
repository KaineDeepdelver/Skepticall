package net.omnimedia.omni.network.dto;

import lombok.*;

import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChannelMessageDTO {
    private Long id;
    private Long channelId;
    private Long authorId;
    private String authorUsername;
    private String authorDisplayName;
    private String authorAvatar;
    private String authorRoleColor; // highest-position role's colour for this author in this network; null = default text colour
    private String content;
    private String fileUrl;
    private Boolean edited;
    private LocalDateTime createdAt;
    private String _tmpId; // optimistic-send correlation, mirrors GroupMessageDTO
}
