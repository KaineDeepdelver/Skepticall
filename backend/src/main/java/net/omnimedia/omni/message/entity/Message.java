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

    @Column(nullable = false)
    private Boolean edited = false;

    private Long   replyToId;
    private String replyPreview;
    private String status;
    private Integer durationSeconds; // SENT, DELIVERED, READ

    // == /tempo self-destruct ==
    // Set when the message is sent with /tempo prefix. Null for normal messages.
    private LocalDateTime tempoExpiresAt;
}
