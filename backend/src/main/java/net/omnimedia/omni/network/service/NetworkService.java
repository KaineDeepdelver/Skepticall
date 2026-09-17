package net.omnimedia.omni.network.service;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.config.R2StorageService;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.network.dto.*;
import net.omnimedia.omni.network.entity.*;
import net.omnimedia.omni.network.repository.*;
import net.omnimedia.omni.user.entity.User;
import net.omnimedia.omni.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NetworkService {

    private static final String INVITE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final NetworkRepository networkRepository;
    private final NetworkRoleRepository networkRoleRepository;
    private final NetworkMemberRepository networkMemberRepository;
    private final NetworkBanRepository networkBanRepository;
    private final ChannelRepository channelRepository;
    private final ChannelCategoryRepository channelCategoryRepository;
    private final UserRepository userRepository;
    private final NetworkPermissionService permissions;
    private final R2StorageService r2Storage;

    // ── Create / read ──────────────────────────────────────────────────

    @Transactional
    public NetworkDTO createNetwork(Long ownerId, String name, String iconUrl) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User not found [ownerId=" + ownerId + "]"));

        Network network = networkRepository.save(Network.builder()
                .name(name.trim())
                .iconUrl(iconUrl)
                .owner(owner)
                .inviteCode(generateInviteCode())
                .build());

        // Auto-created @everyone-equivalent role — floor permissions, position 0,
        // can be edited later but never deleted.
        networkRoleRepository.save(NetworkRole.builder()
                .network(network)
                .name("@everyone")
                .color("#71767b")
                .position(0)
                .permissions(NetworkPermission.defaultMask())
                .isDefault(true)
                .build());

        networkMemberRepository.save(NetworkMember.builder()
                .network(network)
                .user(owner)
                .build());

        channelRepository.save(Channel.builder()
                .network(network)
                .name("general")
                .type(Channel.Type.TEXT)
                .position(0)
                .build());

        return toDTO(network);
    }

    public List<NetworkDTO> getNetworksForUser(Long userId) {
        return networkMemberRepository.findByUserId(userId).stream()
                .map(NetworkMember::getNetwork)
                .map(this::toDTO)
                .toList();
    }

    public NetworkDTO getNetwork(Long networkId) {
        return toDTO(requireNetwork(networkId));
    }

    // ── Membership ──────────────────────────────────────────────────────

    @Transactional
    public NetworkDTO joinByInviteCode(Long userId, String inviteCode) {
        Network network = networkRepository.findByInviteCode(inviteCode)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Invalid invite code"));

        if (networkBanRepository.existsByNetworkIdAndBannedUserId(network.getId(), userId)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "You are banned from this network");
        }

        if (networkMemberRepository.existsByNetworkIdAndUserId(network.getId(), userId)) {
            return toDTO(network); // already a member — no-op
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User not found [userId=" + userId + "]"));

        networkMemberRepository.save(NetworkMember.builder().network(network).user(user).build());
        return toDTO(network);
    }

    @Transactional
    public void leaveNetwork(Long networkId, Long userId) {
        Network network = requireNetwork(networkId);
        if (permissions.isOwner(network, userId)) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "Owner can't leave their own network — delete or transfer it instead");
        }
        networkMemberRepository.deleteByNetworkIdAndUserId(networkId, userId);
    }

    @Transactional
    public void kickMember(Long networkId, Long requesterId, Long targetUserId) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);
        NetworkMember target = requireMember(network, targetUserId);

        if (!permissions.hasPermission(network, requester, NetworkPermission.KICK_MEMBERS)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Missing KICK_MEMBERS permission");
        }
        requireModerator2faIfNeeded(network, requester);
        if (!permissions.canActOnMember(network, requester, target)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Can't kick a member ranked at or above you");
        }
        networkMemberRepository.delete(target);
    }

    public List<NetworkMemberDTO> getMembers(Long networkId) {
        Network network = requireNetwork(networkId);
        return networkMemberRepository.findByNetworkId(networkId).stream()
                .map(m -> toMemberDTO(network, m))
                .toList();
    }

    // ── Server Profile / Access / Safety Setup ────────────────────────────

    private static final Set<String> VALID_ACCESS_MODES = Set.of("INVITE_ONLY", "APPLY_TO_JOIN");

    /**
     * Partial update — every field is a nullable "if present, set it" arg,
     * mirroring the pattern used by updateRole. Requires MANAGE_NETWORK
     * (owner always has it).
     */
    @Transactional
    public NetworkDTO updateNetwork(
            Long networkId, Long requesterId,
            String name, String description, Boolean privateProfile,
            String accessMode, Boolean ageRestricted, Boolean rulesEnabled, List<String> rules,
            Boolean require2faForModeration, Boolean restrictPruneToAdmins
    ) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);

        if (!permissions.hasPermission(network, requester, NetworkPermission.MANAGE_NETWORK)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Missing MANAGE_NETWORK permission");
        }

        if (name != null) {
            String trimmed = name.trim();
            if (trimmed.isEmpty()) {
                throw new BusinessException(ErrorType.INVALID_OPERATION, "Server name can't be empty");
            }
            network.setName(trimmed);
        }
        if (description != null) network.setDescription(description);
        if (privateProfile != null) network.setPrivateProfile(privateProfile);
        if (accessMode != null) {
            if (!VALID_ACCESS_MODES.contains(accessMode)) {
                throw new BusinessException(ErrorType.INVALID_OPERATION, "Invalid access mode [accessMode=" + accessMode + "]");
            }
            network.setAccessMode(accessMode);
        }
        if (ageRestricted != null) network.setAgeRestricted(ageRestricted);
        if (rulesEnabled != null) network.setRulesEnabled(rulesEnabled);
        if (rules != null) {
            network.getRules().clear();
            network.getRules().addAll(rules.stream().filter(r -> r != null && !r.isBlank()).toList());
        }
        if (require2faForModeration != null) network.setRequire2faForModeration(require2faForModeration);
        if (restrictPruneToAdmins != null) network.setRestrictPruneToAdmins(restrictPruneToAdmins);

        return toDTO(networkRepository.save(network));
    }

    /** Requires MANAGE_NETWORK, same as the rest of the profile fields. */
    @Transactional
    public NetworkDTO updateIcon(Long networkId, Long requesterId, MultipartFile file) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);
        if (!permissions.hasPermission(network, requester, NetworkPermission.MANAGE_NETWORK)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Missing MANAGE_NETWORK permission");
        }
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "No file provided");
        }
        network.setIconUrl(saveFile(file, "network_icon"));
        return toDTO(networkRepository.save(network));
    }

    @Transactional
    public NetworkDTO updateBanner(Long networkId, Long requesterId, MultipartFile file) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);
        if (!permissions.hasPermission(network, requester, NetworkPermission.MANAGE_NETWORK)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Missing MANAGE_NETWORK permission");
        }
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "No file provided");
        }
        network.setBannerUrl(saveFile(file, "network_banner"));
        return toDTO(networkRepository.save(network));
    }

    @Transactional
    public NetworkDTO removeIcon(Long networkId, Long requesterId) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);
        if (!permissions.hasPermission(network, requester, NetworkPermission.MANAGE_NETWORK)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Missing MANAGE_NETWORK permission");
        }
        network.setIconUrl(null);
        return toDTO(networkRepository.save(network));
    }

    @Transactional
    public NetworkDTO removeBanner(Long networkId, Long requesterId) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);
        if (!permissions.hasPermission(network, requester, NetworkPermission.MANAGE_NETWORK)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Missing MANAGE_NETWORK permission");
        }
        network.setBannerUrl(null);
        return toDTO(networkRepository.save(network));
    }

    // Files now live in Cloudflare R2 (see R2StorageService) instead of
    // local disk — Render's ephemeral filesystem meant any file written
    // locally was lost on the next redeploy/restart/spin-down.
    private String saveFile(MultipartFile file, String prefix) {
        return r2Storage.upload(file, prefix);
    }

    // ── Bans ────────────────────────────────────────────────────────────

    @Transactional
    public NetworkBanDTO banMember(Long networkId, Long requesterId, Long targetUserId, String reason) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);

        if (!permissions.hasPermission(network, requester, NetworkPermission.BAN_MEMBERS)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Missing BAN_MEMBERS permission");
        }
        requireModerator2faIfNeeded(network, requester);
        if (permissions.isOwner(network, targetUserId)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Can't ban the network owner");
        }

        // If they're currently a member, hierarchy applies same as kicking;
        // if they've already left, there's no member row to rank-check
        // against, so anyone with BAN_MEMBERS can still ban by user id.
        networkMemberRepository.findByNetworkIdAndUserId(networkId, targetUserId).ifPresent(target -> {
            if (!permissions.canActOnMember(network, requester, target)) {
                throw new BusinessException(ErrorType.PERMISSION_DENIED, "Can't ban a member ranked at or above you");
            }
            networkMemberRepository.delete(target);
        });

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User not found [userId=" + targetUserId + "]"));
        User requesterUser = requester.getUser();

        NetworkBan ban = networkBanRepository.findByNetworkIdAndBannedUserId(networkId, targetUserId)
                .orElse(NetworkBan.builder().network(network).bannedUser(target).build());
        ban.setBannedBy(requesterUser);
        ban.setReason(reason);
        return toBanDTO(networkBanRepository.save(ban));
    }

    @Transactional
    public void unbanMember(Long networkId, Long requesterId, Long targetUserId) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);

        if (!permissions.hasPermission(network, requester, NetworkPermission.BAN_MEMBERS)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Missing BAN_MEMBERS permission");
        }
        networkBanRepository.deleteByNetworkIdAndBannedUserId(networkId, targetUserId);
    }

    public List<NetworkBanDTO> getBans(Long networkId, Long requesterId) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);

        if (!permissions.hasPermission(network, requester, NetworkPermission.BAN_MEMBERS)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Missing BAN_MEMBERS permission");
        }
        return networkBanRepository.findByNetworkIdOrderByCreatedAtDesc(networkId).stream()
                .map(this::toBanDTO)
                .toList();
    }

    // ── Roles ───────────────────────────────────────────────────────────

    @Transactional
    public NetworkRoleDTO createRole(Long networkId, Long requesterId, String name, String color, long permissionMask, Integer position) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);

        if (!permissions.hasPermission(network, requester, NetworkPermission.MANAGE_ROLES)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Missing MANAGE_ROLES permission");
        }

        int requesterRank = permissions.highestPosition(requester);
        boolean isOwner = permissions.isOwner(network, requesterId);
        int newPosition = position != null ? position : networkRoleRepository.findMaxPosition(networkId) + 1;

        if (!isOwner && newPosition >= requesterRank) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Can't create a role ranked at or above your own");
        }

        NetworkRole role = networkRoleRepository.save(NetworkRole.builder()
                .network(network)
                .name(name.trim())
                .color(color != null ? color : "#7c5cfc")
                .position(newPosition)
                .permissions(permissionMask)
                .isDefault(false)
                .build());

        return toRoleDTO(role);
    }

    @Transactional
    public NetworkRoleDTO updateRole(Long networkId, Long requesterId, Long roleId, String name, String color, Long permissionMask) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);
        NetworkRole role = requireRole(network, roleId);

        if (!permissions.canManageRole(network, requester, role)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Can't manage a role ranked at or above you");
        }

        if (name != null) role.setName(name.trim());
        if (color != null) role.setColor(color);
        if (permissionMask != null) role.setPermissions(permissionMask);
        return toRoleDTO(networkRoleRepository.save(role));
    }

    @Transactional
    public void deleteRole(Long networkId, Long requesterId, Long roleId) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);
        NetworkRole role = requireRole(network, roleId);

        if (role.isDefault()) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "The @everyone role can't be deleted");
        }
        if (!permissions.canManageRole(network, requester, role)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Can't manage a role ranked at or above you");
        }
        networkRoleRepository.delete(role);
    }

    @Transactional
    public void assignRole(Long networkId, Long requesterId, Long targetUserId, Long roleId) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);
        NetworkMember target = requireMember(network, targetUserId);
        NetworkRole role = requireRole(network, roleId);

        if (!permissions.canManageRole(network, requester, role)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Can't assign a role ranked at or above you");
        }
        if (!permissions.canActOnMember(network, requester, target)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Can't assign roles to a member ranked at or above you");
        }
        if (!target.getRoles().contains(role)) {
            target.getRoles().add(role);
            networkMemberRepository.save(target);
        }
    }

    @Transactional
    public void removeRole(Long networkId, Long requesterId, Long targetUserId, Long roleId) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);
        NetworkMember target = requireMember(network, targetUserId);
        NetworkRole role = requireRole(network, roleId);

        if (!permissions.canManageRole(network, requester, role)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Can't manage a role ranked at or above you");
        }
        if (!permissions.canActOnMember(network, requester, target)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Can't manage roles on a member ranked at or above you");
        }
        target.getRoles().removeIf(r -> r.getId().equals(roleId));
        networkMemberRepository.save(target);
    }

    // ── Categories ──────────────────────────────────────────────────────

    @Transactional
    public ChannelCategoryDTO createCategory(Long networkId, Long requesterId, String name) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);
        requireManageChannels(network, requester);

        int position = channelCategoryRepository.findMaxPosition(networkId) + 1;
        ChannelCategory category = channelCategoryRepository.save(ChannelCategory.builder()
                .network(network)
                .name(name.trim())
                .position(position)
                .build());
        return toCategoryDTO(category);
    }

    @Transactional
    public ChannelCategoryDTO renameCategory(Long networkId, Long requesterId, Long categoryId, String name) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);
        requireManageChannels(network, requester);

        ChannelCategory category = requireCategory(network, categoryId);
        category.setName(name.trim());
        return toCategoryDTO(channelCategoryRepository.save(category));
    }

    @Transactional
    public void deleteCategory(Long networkId, Long requesterId, Long categoryId) {
        Network network = requireNetwork(networkId);
        NetworkMember requester = requireMember(network, requesterId);
        requireManageChannels(network, requester);

        ChannelCategory category = requireCategory(network, categoryId);
        // Channels in a deleted category fall back to uncategorized, rather
        // than being deleted along with it.
        for (Channel c : channelRepository.findByNetworkIdOrderByPositionAsc(networkId)) {
            if (c.getCategory() != null && c.getCategory().getId().equals(categoryId)) {
                c.setCategory(null);
                channelRepository.save(c);
            }
        }
        channelCategoryRepository.delete(category);
    }

    private ChannelCategory requireCategory(Network network, Long categoryId) {
        ChannelCategory category = channelCategoryRepository.findById(categoryId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Category not found [categoryId=" + categoryId + "]"));
        if (!category.getNetwork().getId().equals(network.getId())) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "Category does not belong to this network");
        }
        return category;
    }

    private void requireManageChannels(Network network, NetworkMember requester) {
        if (!permissions.hasPermission(network, requester, NetworkPermission.MANAGE_CHANNELS)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Missing MANAGE_CHANNELS permission");
        }
    }

    /**
     * Real enforcement of the "Require 2FA for moderator actions" Safety
     * Setup toggle — applies to every rank, including the owner, matching
     * Discord's actual behavior (only *changing* the setting is
     * owner-gated, not obeying it once it's on).
     */
    private void requireModerator2faIfNeeded(Network network, NetworkMember requester) {
        if (network.isRequire2faForModeration() && !requester.getUser().isTwoFactorEnabled()) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED,
                    "This server requires two-factor authentication for moderator actions — enable 2FA on your account first");
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    public Network requireNetwork(Long networkId) {
        return networkRepository.findById(networkId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Network not found [networkId=" + networkId + "]"));
    }

    public NetworkMember requireMember(Network network, Long userId) {
        return networkMemberRepository.findByNetworkIdAndUserId(network.getId(), userId)
                .orElseThrow(() -> new BusinessException(ErrorType.PERMISSION_DENIED, "Not a member of this network"));
    }

    private NetworkRole requireRole(Network network, Long roleId) {
        NetworkRole role = networkRoleRepository.findById(roleId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Role not found [roleId=" + roleId + "]"));
        if (!role.getNetwork().getId().equals(network.getId())) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "Role does not belong to this network");
        }
        return role;
    }

    private String generateInviteCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder(8);
            for (int i = 0; i < 8; i++) sb.append(INVITE_CHARS.charAt(RANDOM.nextInt(INVITE_CHARS.length())));
            code = sb.toString();
        } while (networkRepository.findByInviteCode(code).isPresent());
        return code;
    }

    private NetworkDTO toDTO(Network network) {
        List<ChannelDTO> channels = channelRepository.findByNetworkIdOrderByPositionAsc(network.getId()).stream()
                .map(this::toChannelDTO)
                .toList();
        List<ChannelCategoryDTO> categories = channelCategoryRepository.findByNetworkIdOrderByPositionAsc(network.getId()).stream()
                .map(this::toCategoryDTO)
                .toList();
        List<NetworkRoleDTO> roles = networkRoleRepository.findByNetworkIdOrderByPositionDesc(network.getId()).stream()
                .map(this::toRoleDTO)
                .toList();
        int memberCount = networkMemberRepository.findByNetworkId(network.getId()).size();

        return NetworkDTO.builder()
                .id(network.getId())
                .name(network.getName())
                .iconUrl(network.getIconUrl())
                .bannerUrl(network.getBannerUrl())
                .ownerId(network.getOwner().getId())
                .inviteCode(network.getInviteCode())
                .memberCount(memberCount)
                .channels(channels)
                .categories(categories)
                .roles(roles)
                .description(network.getDescription())
                .privateProfile(network.isPrivateProfile())
                .accessMode(network.getAccessMode())
                .ageRestricted(network.isAgeRestricted())
                .rulesEnabled(network.isRulesEnabled())
                .rules(new ArrayList<>(network.getRules()))
                .require2faForModeration(network.isRequire2faForModeration())
                .restrictPruneToAdmins(network.isRestrictPruneToAdmins())
                .build();
    }

    private ChannelDTO toChannelDTO(Channel c) {
        return ChannelDTO.builder()
                .id(c.getId())
                .networkId(c.getNetwork().getId())
                .categoryId(c.getCategory() != null ? c.getCategory().getId() : null)
                .name(c.getName())
                .type(c.getType().name())
                .position(c.getPosition())
                .build();
    }

    private ChannelCategoryDTO toCategoryDTO(ChannelCategory cat) {
        return ChannelCategoryDTO.builder()
                .id(cat.getId())
                .networkId(cat.getNetwork().getId())
                .name(cat.getName())
                .position(cat.getPosition())
                .build();
    }

    private NetworkRoleDTO toRoleDTO(NetworkRole r) {
        return NetworkRoleDTO.builder()
                .id(r.getId())
                .networkId(r.getNetwork().getId())
                .name(r.getName())
                .color(r.getColor())
                .position(r.getPosition())
                .permissions(r.getPermissions())
                .isDefault(r.isDefault())
                .build();
    }

    private NetworkBanDTO toBanDTO(NetworkBan ban) {
        User u = ban.getBannedUser();
        User by = ban.getBannedBy();
        return NetworkBanDTO.builder()
                .id(ban.getId())
                .networkId(ban.getNetwork().getId())
                .userId(u.getId())
                .username(u.getUsername())
                .displayName(u.getDisplayName())
                .avatar(u.getProfilePicture())
                .reason(ban.getReason())
                .bannedByUserId(by != null ? by.getId() : null)
                .bannedByUsername(by != null ? by.getUsername() : null)
                .createdAt(ban.getCreatedAt())
                .build();
    }

    private NetworkMemberDTO toMemberDTO(Network network, NetworkMember m) {
        User u = m.getUser();
        return NetworkMemberDTO.builder()
                .id(m.getId())
                .userId(u.getId())
                .username(u.getUsername())
                .displayName(u.getDisplayName())
                .avatar(u.getProfilePicture())
                .nickname(m.getNickname())
                .roles(m.getRoles().stream().map(this::toRoleDTO).collect(Collectors.toList()))
                .isOwner(permissions.isOwner(network, u.getId()))
                .joinedAt(m.getCreatedAt())
                .build();
    }
}
