package com.skepticall.app.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** What the client gets back about its stored key backup. {@code exists} is false when none has been saved. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KeyVaultDTO {

    private boolean exists;

    /** Base64 of the passphrase-protected key backup; null when {@code exists} is false. */
    private String blob;

    /** The account's current public key when the backup was made; null when {@code exists} is false. */
    private String currentPublicKey;

    private LocalDateTime updatedAt;
}
