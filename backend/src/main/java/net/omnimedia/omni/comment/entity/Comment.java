package net.omnimedia.omni.comment.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;
import net.omnimedia.omni.user.entity.User;

@Entity @Table(name = "comments")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Comment extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "author_id", nullable = false)
    private User author;

    // Either postId OR mediaId is set
    private Long postId;
    private Long mediaId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    private Long parentId;

    @Builder.Default private int likeCount    = 0;
    @Builder.Default private int dislikeCount = 0;
}
