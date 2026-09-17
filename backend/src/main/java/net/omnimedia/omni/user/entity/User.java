package net.omnimedia.omni.user.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User extends BaseEntity {

    // == User ==

    private String username;
    private String email;
    private String password;
    private String profilePicture;
    private String bannerPicture;
    private String displayName;
    private String bio;

    // == Stats (default 0) ==

    @Builder.Default
    private int postCount = 0;

    @Builder.Default
    private int mediaCount = 0;

    @Builder.Default
    private int followerCount = 0;

    @Builder.Default
    private int followingCount = 0;

    // == Admin ==

//    @Builder.Default
//    private boolean admin = false;

    // == Privacy ==

    @Builder.Default
    private boolean privacyMode = false;

    @Builder.Default
    private boolean anonymousMode = false;

    // == Presence ==

    @Builder.Default
    private boolean appearOffline = false;

    // == Notifications ==

    @Builder.Default
    private boolean notifMessages = true;

    @Builder.Default
    private boolean notifMentions = true;

    @Builder.Default
    private boolean notifFollows = true;

    @Builder.Default
    private boolean notifReposts = true;

    // == Security / Content ==

    @Builder.Default
    private boolean profanityMode = false;

    @Builder.Default
    private boolean ipLoginAlerts = false;

    @Builder.Default
    private boolean twoFactorEnabled = false;

    // == Login tracking ==

    @Builder.Default
    private int failedLogInAttempt = 0;

    @Builder.Default
    private boolean lockDownMode = false;

    private String lastLoginIp;
    private String lastLoginAt;
    private boolean online = false;

    // == ToS ==

    @Builder.Default
    private boolean tosAccepted = false;
}
