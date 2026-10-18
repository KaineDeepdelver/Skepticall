package com.skepticall.app.user.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;
import com.skepticall.app.common.BaseEntity;

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

    // == End-to-end encryption ==
    // X25519 public key (base64) that incoming messages are encrypted to. Generated
    // on-device at account creation; the owner can reroll it (see PublicKeyService).
    // This always mirrors the account's current row in user_public_keys, which also keeps
    // retired keys valid for 30 days. This is the only half of the keypair the server ever
    // sees; the private key stays on the device (and inside the user's encrypted .dat
    // backup). Nullable because accounts created before E2E existed won't have one;
    // those stay unencrypted until they set one with the rotate endpoint.
    private String publicKey;

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

    // Anonymous mode was removed as a feature. Kept (unused) so the existing NOT NULL column
    // still gets a value on insert; drop the column in the database, then delete this field.
    @Builder.Default
    private boolean anonymousMode = false;

    // Nullable Boolean on purpose: ddl-auto=update can't add a NOT NULL column to a
    // table that already has rows. null means "never set" = the old behaviour (allowed).
    private Boolean allowFriendRequests;
    private Boolean groupInvitesAnyone;

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
    // Consent record: when the terms were accepted, which version, and when the age was confirmed.
    private java.time.Instant tosAcceptedAt;
    private String tosVersion;
    private java.time.Instant ageConfirmedAt;

}
