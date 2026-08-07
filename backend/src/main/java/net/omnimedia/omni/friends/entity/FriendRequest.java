package net.omnimedia.omni.friends.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.user.entity.User;
import java.time.LocalDateTime;

@Entity @Table(name = "friend_requests",
    uniqueConstraints = @UniqueConstraint(columnNames = {"sender_id","receiver_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FriendRequest {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "sender_id")   private User sender;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "receiver_id") private User receiver;
    // PENDING | ACCEPTED | REJECTED
    @Builder.Default private String status = "PENDING";
    @Builder.Default private LocalDateTime createdAt = LocalDateTime.now();
}
