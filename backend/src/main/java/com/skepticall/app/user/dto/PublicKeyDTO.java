package com.skepticall.app.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** A public key an account has used and whether it is still valid. Public keys are public. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PublicKeyDTO {

    /** Base64 X25519 public key. */
    private String publicKey;

    /** True for the key new messages should be encrypted to. */
    private boolean current;

    private LocalDateTime activatedAt;

    /** When the key was replaced; null for the current key. */
    private LocalDateTime retiredAt;

    /** When a retired key stops being accepted (retiredAt + grace period); null for the current key. */
    private LocalDateTime expiresAt;
}
