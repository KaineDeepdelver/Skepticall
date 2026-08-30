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
    private LocalDateTime createdAt;
    private Boolean edited = false;

    // Reply support
    private Long   replyToId;
    private String replyPreview;

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
