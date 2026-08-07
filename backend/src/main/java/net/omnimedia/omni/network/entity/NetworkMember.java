package net.omnimedia.omni.network.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;
import net.omnimedia.omni.user.entity.User;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "network_members", uniqueConstraints = @UniqueConstraint(columnNames = {"network_id", "user_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NetworkMember extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "network_id")
    private Network network;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    private String nickname; // per-network display name override, optional

    @ManyToMany
    @JoinTable(
            name = "network_member_roles",
            joinColumns = @JoinColumn(name = "network_member_id"),
            inverseJoinColumns = @JoinColumn(name = "network_role_id")
    )
    @Builder.Default
    private List<NetworkRole> roles = new ArrayList<>();
}
