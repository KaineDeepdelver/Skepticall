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
