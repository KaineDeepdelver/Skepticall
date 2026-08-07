package net.omnimedia.omni.network.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;
import net.omnimedia.omni.user.entity.User;

// A ban both removes the member (if currently one) and blocks them from
// rejoining via invite code — see NetworkService.joinByInviteCode. Kicking
// alone (NetworkMember deletion) does not create one of these; only an
// explicit ban does.
@Entity
@Table(name = "network_bans", uniqueConstraints = @UniqueConstraint(columnNames = {"network_id", "banned_user_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NetworkBan extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "network_id")
    private Network network;

    @ManyToOne
    @JoinColumn(name = "banned_user_id")
    private User bannedUser;

    @ManyToOne
    @JoinColumn(name = "banned_by_user_id")
    private User bannedBy;

    @Column(columnDefinition = "TEXT")
    private String reason;
}
