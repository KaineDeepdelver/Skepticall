package net.omnimedia.omni.follow.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.user.entity.User;
import java.time.LocalDateTime;

@Entity @Table(name = "follows",
    uniqueConstraints = @UniqueConstraint(columnNames = {"follower_id","following_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Follow {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "follower_id")  private User follower;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "following_id") private User following;
    @Builder.Default private LocalDateTime createdAt = LocalDateTime.now();
}
