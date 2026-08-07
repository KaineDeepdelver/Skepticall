package net.omnimedia.omni.admin.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.user.entity.User;
import java.time.LocalDateTime;

/**
 * Presence of a row in this table is what makes a user an admin —
 * there is no boolean flag on the User entity itself. One row per admin,
 * parented to the user it grants admin rights to.
 */
@Entity @Table(name = "admins")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Admin {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // == Parent user — the account that holds admin rights ==
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
