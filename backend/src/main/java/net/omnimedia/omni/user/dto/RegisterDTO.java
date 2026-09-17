package net.omnimedia.omni.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RegisterDTO {

    private String displayName;

    @NotBlank
    private String username;

    @NotBlank
    private String email;

    @NotBlank
    private String password;

    /** Token from the reCAPTCHA widget — verified server-side before account creation. */
    @NotBlank
    private String captchaToken;
}
