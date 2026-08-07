package net.omnimedia.omni.user.mapper;

import net.omnimedia.omni.user.dto.UserDTO;
import net.omnimedia.omni.user.dto.UserPublicDTO;
import net.omnimedia.omni.user.entity.User;

public class UserMapper {

    /** Full DTO — only for the authenticated user's own data (e.g. /users/me) */
    public static UserDTO toDTO(User user) {
        return UserDTO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .bio(user.getBio())
                .profilePicture(user.getProfilePicture())
                .bannerPicture(user.getBannerPicture())
                .displayName(user.getDisplayName())
                .postCount(user.getPostCount())
                .mediaCount(user.getMediaCount())
                .followerCount(user.getFollowerCount())
                .followingCount(user.getFollowingCount())
                .privacyMode(user.isPrivacyMode())
                .anonymousMode(user.isAnonymousMode())
                .appearOffline(user.isAppearOffline())
                .notifMessages(user.isNotifMessages())
                .notifMentions(user.isNotifMentions())
                .notifFollows(user.isNotifFollows())
                .notifReposts(user.isNotifReposts())
                .profanityMode(user.isProfanityMode())
                .ipLoginAlerts(user.isIpLoginAlerts())
                .twoFactorEnabled(user.isTwoFactorEnabled())
                .lastLoginIp(user.getLastLoginIp())
                .lastLoginAt(user.getLastLoginAt())
                .createdAt(user.getCreatedAt())
                .online(user.isOnline())
                .build();
    }

    /** Public DTO — safe to return to any user, no sensitive fields */
    public static UserPublicDTO toPublicDTO(User user) {
        return UserPublicDTO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .profilePicture(user.getProfilePicture())
                .bannerPicture(user.getBannerPicture())
                .bio(user.getBio())
                .postCount(user.getPostCount())
                .mediaCount(user.getMediaCount())
                .followerCount(user.getFollowerCount())
                .followingCount(user.getFollowingCount())
                .online(user.isOnline())
                .createdAt(user.getCreatedAt() != null ? user.getCreatedAt().toString() : null)
                .build();
    }

    public static User toEntity(UserDTO dto) {
        return User.builder()
                .username(dto.getUsername())
                .email(dto.getEmail())
                .bio(dto.getBio())
                .profilePicture(dto.getProfilePicture())
                .bannerPicture(dto.getBannerPicture())
                .displayName(dto.getDisplayName())
                .postCount(dto.getPostCount())
                .mediaCount(dto.getMediaCount())
                .followerCount(dto.getFollowerCount())
                .followingCount(dto.getFollowingCount())
                .privacyMode(dto.getPrivacyMode())
                .anonymousMode(dto.getAnonymousMode())
                .build();
    }
}
