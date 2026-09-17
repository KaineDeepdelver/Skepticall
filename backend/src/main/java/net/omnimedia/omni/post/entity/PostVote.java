package net.omnimedia.omni.post.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.user.entity.User;

@Entity
@Table(name = "post_votes",
    uniqueConstraints = @UniqueConstraint(columnNames = {"post_id","user_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder

public class PostVote {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "post_id") private Post post;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id") private User user;

    private String voteType; // LIKE | DISLIKE
}
