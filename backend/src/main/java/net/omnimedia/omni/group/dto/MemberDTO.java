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
}
