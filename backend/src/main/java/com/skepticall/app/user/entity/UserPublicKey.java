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
 * One X25519 public key an account has used. Exactly one row per account is "current"
 * (retiredAt == null); rerolling retires it and it stays usable for the grace period
 * (keys.retired-grace-days, default 30) so messages encrypted to it before the sender
 * learned about the new key can still be opened. User.publicKey always mirrors the current row.
 */
@Entity
@Table(name = "user_public_keys")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserPublicKey extends BaseEntity {

    private Long userId;

    /** Canonical (standard, padded) base64 of the 32-byte key. */
    @Column(length = 128)
    private String publicKey;

    /** When this key became the account's current key. */
    private LocalDateTime activatedAt;

    /** When it was replaced; null while it is the current key. */
    private LocalDateTime retiredAt;
}
