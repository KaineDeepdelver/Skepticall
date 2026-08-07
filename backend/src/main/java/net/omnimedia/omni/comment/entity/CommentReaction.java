package net.omnimedia.omni.comment.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.user.entity.User;

@Entity @Table(name = "comment_reactions",
    uniqueConstraints = @UniqueConstraint(columnNames = {"comment_id","user_id","emoji"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CommentReaction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "comment_id") private Comment comment;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id") private User user;
    private String emoji; // e.g. "👍", "❤️", "😂"
}
