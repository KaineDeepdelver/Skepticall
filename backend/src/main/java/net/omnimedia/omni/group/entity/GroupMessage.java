package net.omnimedia.omni.group.entity;
import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;
import net.omnimedia.omni.user.entity.User;
@Entity @Table(name="group_messages")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GroupMessage extends BaseEntity {

    @ManyToOne
    @JoinColumn(name="group_id")
    private GroupConversation group;

    @ManyToOne
    @JoinColumn(name="sender_id")
    private User sender;

    @Column(columnDefinition="TEXT")
    private String content;

    private String type;
    private String fileUrl;

    @Builder.Default
    private Boolean edited = false;
    private String status;

    // Reply support — mirrors Message.java's replyToId/replyPreview/
    // replyPreviewSender exactly. Not a foreign key/join: same
    // client-snapshotted-string approach as DMs, so history and
    // moderation (deleted originals) behave identically.
    private Long   replyToId;
    private String replyPreview;
    private String replyPreviewSender;

    // == E2E encryption — see GroupMessageKey for the per-member key
    // fan-out these nonces pair with ==
    // `content` holds the shared ciphertext (one copy, same for every
    // member) once this is non-null; `nonce` is what unlocks it together
    // with a member's own unwrapped content key.
    private String nonce;
    // `replyPreview` is encrypted independently (own nonce), but shares
    // the SAME content key as `content` — no need for a third per-member
    // key just for the quoted preview.
    private String replyPreviewNonce;
    // `fileUrl`'s blob is encrypted with the MEDIA key (a different key
    // than CONTENT — see GroupMessageKey.keyType), this is that
    // operation's nonce.
    private String mediaNonce;

    // Call-log entries (type == "CALL") — WhatsApp-style "X started a
    // call" row rendered inline in the chat instead of the raw ephemeral
    // GROUP_CALL_INVITE signal. callId correlates this row back to the
    // in-memory ROOMS entry in GroupCallWsController so a later
    // /call.group.end can find and flip this same row to ENDED instead of
    // logging a brand-new one. callStatus is ONGOING while the room is
    // still open and ENDED once it's torn down; content holds the call
    // type ("audio"/"video") for this message type.
    private String callId;
    private String callStatus;
}
