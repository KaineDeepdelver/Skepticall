package net.omnimedia.omni.network.dto;

import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NetworkMemberDTO {
    private Long id; // NetworkMember id
    private Long userId;
    private String username;
    private String displayName;
    private String avatar;
    private String nickname;
    private List<NetworkRoleDTO> roles;
    private boolean isOwner;
    private LocalDateTime joinedAt;
}
