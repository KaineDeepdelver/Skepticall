package com.skepticall.app.user.dto;

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
     * request is sent. Required, so every account starts with a key and
     * there is no "unencrypted account" window. It can be rerolled later
     * (the old key stays valid for 30 days).
     */
    @NotBlank
    private String publicKey;

    /** The person ticked "I accept the Terms of Service and Privacy Policy". */
    private Boolean tosAccepted;

    /** The person confirmed they are at least the minimum age (see compliance.min-age). */
    private Boolean ageConfirmed;

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
