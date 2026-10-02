package net.omnimedia.omni.message.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageDTO {

    private Long id;
    private Long senderId;
    private Long receiverId;
    private String content;
    private String type;
    private String fileUrl;

    // Random nonce (base64) for E2E-encrypted content — see Message.nonce.
    private String nonce;
    // Separate nonce for `replyPreview` — it's encrypted independently of
    // `content` (crypto_box needs a fresh nonce per encryption, so it
    // can't share content's), and without its own nonce a reply would
    // leak the quoted message in plaintext even when content is encrypted.
    private String replyPreviewNonce;

    // Call log fields — see Message.java.
    private String callMode;
    private String callStatus;
    private Integer ringSeconds;
    private Integer callDurationSeconds;

    // Media (file) encryption metadata — see Message.java for what each does.
    private String mediaNonce;
    private String mediaKeyCiphertext;
    private String mediaKeyNonce;
    private LocalDateTime createdAt;
    private Boolean edited = false;

    // Reply support
    private Long   replyToId;
    private String replyPreview;
    private String replyPreviewSender;

    // Voice duration hint (seconds)
    private Integer durationSeconds;

    // JSON array of real amplitude peaks captured at record time — see
    // Message.waveformPeaks. Powers an actual waveform in the voice-note
    // player instead of a decorative placeholder.
    private String waveformPeaks;

    // Read status
    private String status; // SENT, DELIVERED, READ

    // /tempo self-destruct — ISO datetime string when message auto-deletes
    private LocalDateTime tempoExpiresAt;

    // Optimistic-message correlation token — echoed back verbatim so the
    // frontend can replace its temporary placeholder with the real message.
    private String _tmpId;
}
