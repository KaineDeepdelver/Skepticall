package net.omnimedia.omni.user.dto;

import lombok.*;

/**
 * Returned by public-facing endpoints like GET /users/{id} and /users/search.
 * Contains NO private or sensitive fields.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserPublicDTO {

    private Long id;
    private String username;
    private String displayName;
    private String profilePicture;
    private String bannerPicture;
    private String bio;

    private Integer postCount;
    private Integer mediaCount;
    private Integer followerCount;
    private Integer followingCount;

    private Boolean online;
    private String createdAt;

    /** True if this user holds admin/moderator rights — safe to expose publicly as a badge */
    private Boolean admin;
}
