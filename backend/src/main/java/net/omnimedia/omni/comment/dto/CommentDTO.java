package net.omnimedia.omni.comment.dto;

import lombok.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CommentDTO {
    private Long id;
    private Long authorId;
    private String authorUsername;
    private String authorDisplayName;
    private String authorAvatar;
    private Long postId;
    private Long mediaId;
    private Long parentId;
    private String content;
    private int likeCount;
    private int dislikeCount;
    private String userVote;
    private Map<String, Long> reactions;
    private List<String> userReactions;
    private LocalDateTime createdAt;
    private int replyCount;   // ← NEW: number of direct replies
}
