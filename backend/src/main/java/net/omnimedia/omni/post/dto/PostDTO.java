package net.omnimedia.omni.post.dto;

import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PostDTO {
    private Long id;
    private String slug;
    private Long authorId;
    private String authorUsername;
    private String authorDisplayName;
    private String authorAvatar;
    private String title;
    private String content;
    private List<PostMediaDTO> mediaItems;
    private int likeCount;
    private int dislikeCount;
    private int commentCount;
    private String userVote;
    private LocalDateTime createdAt;
}
