package net.omnimedia.omni.network.dto;

import lombok.*;

import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NetworkBanDTO {
    private Long id;
    private Long networkId;
    private Long userId;
    private String username;
    private String displayName;
    private String avatar;
    private String reason;
    private Long bannedByUserId;
    private String bannedByUsername;
    private LocalDateTime createdAt;
}
