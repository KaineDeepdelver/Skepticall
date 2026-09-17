package net.omnimedia.omni.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;

// A device's Expo push token, e.g. "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]".
// Kept separate from User (rather than a column on it) since one user can
// be signed in on several devices at once, and each needs its own push.
@Entity
@Table(name = "push_tokens", uniqueConstraints = @UniqueConstraint(columnNames = "token"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PushToken extends BaseEntity {

    // Not a JPA relationship on purpose — PushNotificationService only
    // ever needs the raw id to look tokens up by user, and this keeps
    // token registration a cheap write with no User fetch required.
    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, unique = true, length = 512)
    private String token;

    // "ios" | "android" — informational only for now (e.g. future
    // per-platform payload tweaks), not used to route anything today.
    private String platform;
}
