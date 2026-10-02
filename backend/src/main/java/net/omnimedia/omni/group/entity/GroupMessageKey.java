package net.omnimedia.omni.group.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;
import net.omnimedia.omni.user.entity.User;

// == Group E2E encryption — per-member key fan-out ==
// There's no single shared secret for a whole group the way a 1:1
// conversation has one. Instead: the message body (and, separately, its
// media) is encrypted ONCE with a random per-message symmetric key
// (crypto_secretbox — same primitive GroupMessage/Message content and
// media encryption both already use), and THAT key gets wrapped
// (crypto_box, asymmetric) once per member, so each member's own private
// key — and only theirs — can unwrap their own copy of the key and
// decrypt the one shared ciphertext body. This is one row per
// (message, recipient, keyType) pair.
//
// Broadcast model: the server has no per-session "send this user a
// different payload" wiring (would need Spring's user-destinations), so
// every member's wrapped-key row is sent to ALL members in the same
// broadcast/history payload — each client just finds and uses its own
// entry by recipientId, ignoring the rest. This leaks no plaintext or key
// material to anyone: a wrapped key is useless without the matching
// private key, which only its intended recipient holds. See
// GroupService.toMsgDTO.
@Entity
@Table(name = "group_message_keys")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GroupMessageKey extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "group_message_id")
    private GroupMessage groupMessage;

    @ManyToOne
    @JoinColumn(name = "recipient_id")
    private User recipient;

    // "CONTENT" (unlocks `content`/`replyPreview`) or "MEDIA" (unlocks
    // `fileUrl`'s encrypted blob) — two independent keys per message,
    // since content and media are separately-encrypted ciphertexts.
    private String keyType;

    @Column(columnDefinition = "TEXT")
    private String wrappedKey;
    private String wrappedKeyNonce;
}
