package net.omnimedia.omni.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;
import net.omnimedia.omni.user.entity.User;

@Entity
@Table(name = "notifications")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification extends BaseEntity {

    // who receives this notification
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_id", nullable = false)
    private User recipient;

    // who triggered it
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id", nullable = false)
    private User actor;

    // POST | MEDIA | MESSAGE | FOLLOW
    @Column(nullable = false)
    private String type;

    // optional reference id (postId, mediaId, messageId)
    private Long refId;

    // URL-safe public identifier for the referenced resource (post slug, etc.)
    private String refSlug;

    // short preview text e.g. post title or message snippet
    private String preview;

    @Builder.Default
    private boolean read = false;
}
