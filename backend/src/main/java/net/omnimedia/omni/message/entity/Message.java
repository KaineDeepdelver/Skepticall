package net.omnimedia.omni.message.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;
import net.omnimedia.omni.user.entity.User;

import java.time.LocalDateTime;

@Entity
@Table(name = "messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Message extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "sender_id")
    private User sender;

    @ManyToOne
    @JoinColumn(name = "receiver_id")
    private User receiver;

    @Column(columnDefinition = "TEXT")
    private String content;

    private String type; // TEXT, IMAGE, VIDEO, VOICE, FILE, GIF, DELETE, TEMPO

    private String fileUrl;

    // == End-to-end encryption ==
    // Random nonce (base64), required by crypto_box for every encrypted
    // message — a message with a non-null nonce has ciphertext in
    // `content`/`fileUrl`; the server cannot read either. Null for
    // messages sent before E2E existed, or from an account without a
    // public key — those remain plaintext.
    private String nonce;
    // Separate nonce for `replyPreview` (see MessageDTO — it's encrypted
    // independently of `content`).
    private String replyPreviewNonce;

    // == Media (file) encryption — envelope encryption, see e2e.js ==
    // `fileUrl` still points at the file in R2 same as before, except the
    // bytes there are now the encrypted blob, not the real file — the
    // server just stores/relays ciphertext, same as for `content`.
    // mediaNonce: nonce used to symmetrically encrypt the file itself.
    private String mediaNonce;
    // mediaKeyCiphertext: the per-file symmetric key, itself encrypted
    // (asymmetrically, crypto_box) for the recipient — only their private
    // key can unwrap it back to the real key needed to decrypt the file.
    private String mediaKeyCiphertext;
    // mediaKeyNonce: nonce for THAT (key-wrapping) encryption operation —
    // distinct from mediaNonce, which is for the file bytes themselves.
    private String mediaKeyNonce;

    @Column(nullable = false)
    private Boolean edited = false;

    private Long   replyToId;
    private String replyPreview;
    // Display name of the sender of the message being replied to, snapshotted
    // client-side at reply time (same approach as replyPreview itself — this
    // whole reply-preview mechanism has never derived from the DB row it
    // points to, it's just an opaque string the client captured when the user
    // tapped "reply"). Null for messages sent before this field existed.
    private String replyPreviewSender;
    private String status;
    private Integer durationSeconds; // SENT, DELIVERED, READ

    // JSON array of ~32 normalized (0..1) peak-amplitude samples captured
    // client-side while recording a VOICE message — see ChannelMessage's
    // identically-named field for the full rationale. Null for non-VOICE
    // messages or voice notes recorded before this field existed.
    @Column(columnDefinition = "TEXT")
    private String waveformPeaks;

    // == Call log (type "CALL") ==
    // Sent by the client as a real message over the same
    // '/app/message.send' path text uses — see CallContext.js's
    // logCallOutcome(). These fields existed on the outgoing WS payload
    // from day one but had nowhere to land here, so they were silently
    // dropped on every call; this finishes that.
    private String callMode;   // "audio" | "video"
    private String callStatus; // "completed" | "missed" | "declined" | "cancelled"
    private Integer ringSeconds;
    private Integer callDurationSeconds;

    // == /tempo self-destruct ==
    // Set when the message is sent as type "TEMPO". Used to be detected by
    // the server reading a "/tempo " prefix off the plaintext content, but
    // that stopped being possible once content can be E2E-encrypted (the
    // server can't read it) — the client now decides this before encrypting
    // and declares it via `type`, same as VOICE/IMAGE/etc. Null for normal
    // messages.
    private LocalDateTime tempoExpiresAt;
}
