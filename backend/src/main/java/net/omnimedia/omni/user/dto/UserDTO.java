package net.omnimedia.omni.user.dto;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import lombok.*;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDTO {

    // == User ==

    private Long id;
    private String username;
    private String email;
    private String profilePicture;
    private String bannerPicture;
    private String displayName;
    private String bio;

    // == Stats ==

    private Integer postCount;
    private Integer mediaCount;
    private Integer followerCount;
    private Integer followingCount;

    // == Privacy ==

    private Boolean privacyMode;
    private Boolean anonymousMode;

    // == Presence ==

    private Boolean appearOffline;

    // == Notifications ==

    private Boolean notifMessages;
    private Boolean notifMentions;
    private Boolean notifFollows;
    private Boolean notifReposts;

    // == Security ==

    private Boolean profanityMode;
    private Boolean ipLoginAlerts;
    private Boolean twoFactorEnabled;

    // == Login tracking ==

    private String lastLoginIp;
    private String lastLoginAt;

    // == Admin ==

    private Boolean admin;

    // == Meta ==

    @JsonSerialize(using = LocalDateTimeSerializer.class)
    @JsonDeserialize(using = LocalDateTimeDeserializer.class)
    private LocalDateTime createdAt;
    private Boolean online;
}
