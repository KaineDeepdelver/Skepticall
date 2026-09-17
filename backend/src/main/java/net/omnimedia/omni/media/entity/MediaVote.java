package net.omnimedia.omni.media.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.user.entity.User;

@Entity @Table(name = "media_votes",
    uniqueConstraints = @UniqueConstraint(columnNames = {"media_id","user_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MediaVote {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "media_id") private MediaItem media;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id") private User user;
    private String voteType; // LIKE | DISLIKE
}
