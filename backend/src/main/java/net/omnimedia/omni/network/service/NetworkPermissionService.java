package net.omnimedia.omni.network.service;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.network.entity.Network;
import net.omnimedia.omni.network.entity.NetworkMember;
import net.omnimedia.omni.network.entity.NetworkPermission;
import net.omnimedia.omni.network.entity.NetworkRole;
import net.omnimedia.omni.network.repository.NetworkRoleRepository;
import org.springframework.stereotype.Service;

/**
 * Central place for "can this member do X" checks so NetworkService and
 * ChannelService don't duplicate hierarchy logic.
 *
 * Hierarchy rule (same idea as Discord): a member's rank is the highest
 * `position` among the roles they hold (or the @everyone role's position,
 * 0, if they hold no custom roles). A member can only manage roles, and act
 * on other members, that rank strictly below their own. The network owner
 * sits outside the role system entirely and always passes every check.
 */
@Service
@RequiredArgsConstructor
public class NetworkPermissionService {

    private final NetworkRoleRepository networkRoleRepository;

    public boolean isOwner(Network network, Long userId) {
        return network.getOwner().getId().equals(userId);
    }

    /** Bitwise OR of every role the member holds, plus the @everyone role's mask. */
    public long effectivePermissions(NetworkMember member) {
        long mask = networkRoleRepository.findByNetworkIdAndIsDefaultTrue(member.getNetwork().getId())
                .map(NetworkRole::getPermissions)
                .orElse(0L);
        for (NetworkRole role : member.getRoles()) {
            mask |= role.getPermissions();
        }
        return mask;
    }

    /** A member's rank — the highest position among roles they hold. */
    public int highestPosition(NetworkMember member) {
        int defaultPosition = networkRoleRepository.findByNetworkIdAndIsDefaultTrue(member.getNetwork().getId())
                .map(NetworkRole::getPosition)
                .orElse(0);
        int highest = defaultPosition;
        for (NetworkRole role : member.getRoles()) {
            if (role.getPosition() > highest) highest = role.getPosition();
        }
        return highest;
    }

    public boolean hasPermission(Network network, NetworkMember member, NetworkPermission perm) {
        if (isOwner(network, member.getUser().getId())) return true;
        return perm.isSetIn(effectivePermissions(member));
    }

    /** Can `requester` create/edit/delete/assign `targetRole`? */
    public boolean canManageRole(Network network, NetworkMember requester, NetworkRole targetRole) {
        if (isOwner(network, requester.getUser().getId())) return true;
        if (!hasPermission(network, requester, NetworkPermission.MANAGE_ROLES)) return false;
        return highestPosition(requester) > targetRole.getPosition();
    }

    /** Can `requester` kick/ban/demote/otherwise act on `target`? */
    public boolean canActOnMember(Network network, NetworkMember requester, NetworkMember target) {
        if (isOwner(network, requester.getUser().getId())) return true;
        if (isOwner(network, target.getUser().getId())) return false; // no one outranks the owner
        return highestPosition(requester) > highestPosition(target);
    }
}
