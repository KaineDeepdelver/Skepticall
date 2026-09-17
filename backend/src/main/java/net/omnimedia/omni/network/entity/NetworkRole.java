package net.omnimedia.omni.network.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;

/**
 * A custom role scoped to a single Network. `position` drives hierarchy:
 * higher position outranks lower. A member's highest-position role is their
 * "rank" — they can only manage roles/members positioned below that rank.
 * The network owner sits outside this system entirely (always top rank).
 */
@Entity
@Table(name = "network_roles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NetworkRole extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "network_id")
    private Network network;

    private String name;
    private String color; // hex string, e.g. "#7c5cfc"

    @Builder.Default
    private int position = 0;

    // Bitmask of NetworkPermission — see that enum for bit meanings.
    @Builder.Default
    private long permissions = 0L;

    // The auto-created @everyone-equivalent role. Every member implicitly
    // holds this role; it can be edited but never deleted or reassigned.
    @Builder.Default
    @Column(name = "is_default")
    private boolean isDefault = false;
}
