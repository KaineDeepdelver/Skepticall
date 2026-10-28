package com.skepticall.app.user.entity;

import com.skepticall.app.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * An account's encryption key, kept so it follows the account to any device.
 *
 * <p>The server never sees the key. {@code blob} is a key backup the client made and locked with a
 * recovery phrase the client generated (Argon2id + authenticated encryption); the phrase never
 * leaves the client. The server stores the locked blob and cannot open it, so end-to-end encryption
 * is unchanged: whoever does not have the phrase cannot read the key, the server included.
 *
 * <p>One row per account. {@code currentPublicKey} records which key was current when the blob was
 * made, so the client can tell when the blob is out of date after a key reroll.
 */
@Entity
@Table(name = "user_key_vaults")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserKeyVault extends BaseEntity {

    @Column(unique = true, nullable = false)
    private Long userId;

    /** Base64 of the passphrase-protected key backup. Opaque to the server. */
    @Column(columnDefinition = "TEXT", nullable = false)
    private String blob;

    /** Canonical base64 of the account's current public key when the blob was saved. */
    @Column(length = 128, nullable = false)
    private String currentPublicKey;

    private LocalDateTime updatedAt;
}
