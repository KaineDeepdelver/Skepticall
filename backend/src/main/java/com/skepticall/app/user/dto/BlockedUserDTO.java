package com.skepticall.app.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A person the caller has blocked, as shown in their blocked list. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BlockedUserDTO {
    private Long userId;
    private String username;
    private String displayName;
    private String profilePicture;
}
