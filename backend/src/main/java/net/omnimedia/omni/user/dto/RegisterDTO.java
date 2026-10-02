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

    /**
     * X25519 public key, base64-encoded, generated on-device before this
     * request is sent. Required — this account's key is meant to be
     * permanent from the moment the account exists, so there's no
     * "unencrypted account" window to design around later.
     */
    @NotBlank
    private String publicKey;

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
