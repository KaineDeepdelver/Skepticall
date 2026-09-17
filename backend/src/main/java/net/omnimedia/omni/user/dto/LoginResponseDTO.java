package net.omnimedia.omni.user.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LoginResponseDTO {
    private String token;
    private UserDTO user;
}
