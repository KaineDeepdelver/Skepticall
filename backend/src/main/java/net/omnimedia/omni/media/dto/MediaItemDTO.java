package net.omnimedia.omni.media.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder

public class MediaItemDTO {
    private Long id;
    private Long authorId;
    private String authorUsername;
    private String authorDisplayName;
    private String authorAvatar;
    private String title;
    private String description;
    private String videoUrl;
    private String thumbnailUrl;
    private int likeCount;
    private int dislikeCount;
    private int commentCount;
    private int viewCount;
    private String userVote;
    private boolean isClip;
    private int durationSeconds;

    private LocalDateTime createdAt;
}
