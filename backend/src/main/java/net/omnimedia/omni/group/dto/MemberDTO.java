package net.omnimedia.omni.group.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder

public class MemberDTO {
    private Long id;
    private String username;
    private String displayName;
    private String avatar;
    // X25519 public key (base64) — needed by any member encrypting a
    // message for this one. Null if this member hasn't set up E2E.
    private String publicKey;
}
