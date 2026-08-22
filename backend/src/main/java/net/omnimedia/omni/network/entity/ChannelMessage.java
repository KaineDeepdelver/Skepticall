package net.omnimedia.omni.network.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;
import net.omnimedia.omni.user.entity.User;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "channel_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChannelMessage extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "channel_id")
    private Channel channel;

    @ManyToOne
    @JoinColumn(name = "author_id")
    private User author;

    @Column(columnDefinition = "TEXT")
    private String content;

    private String fileUrl;

    // Duration of the attached voice clip, in whole seconds — mirrors the
    // DM/group voice-message contract (see message.entity.Message /
    // group.entity.GroupMessage). Null for anything that isn't a VOICE
    // mediaType. Captured client-side while recording since decoding an
    // audio/webm blob's real duration server-side isn't worth the effort
    // for a value the client already knows precisely.
    private Integer durationSeconds;

    // JSON array of ~32 normalized (0..1) peak-amplitude samples, captured
    // client-side via an AnalyserNode on the live mic stream while
    // recording (see ChannelView.js#startRecording). This is what makes
    // the waveform in the UI reflect the actual recording — loud parts
    // render tall, silence renders short — without needing to re-fetch
    // and decode the uploaded audio file after the fact (which would
    // require the storage host to send CORS headers, and wouldn't work
    // at all in browsers that can't decode the recorded codec). Null for
    // anything that isn't VOICE, or for voice notes recorded before this
    // field existed — the frontend falls back to a placeholder in that case.
    @Column(columnDefinition = "TEXT")
    private String waveformPeaks;

    @Builder.Default
    private Boolean edited = false;

    // What kind of content this message carries. Deliberately separate
    // from `type` below (NORMAL/REPLY), which is about reply-threading,
    // not content — a voice note can be a REPLY too, and this field
    // shouldn't be conflated with that one.
    @Builder.Default
    @Enumerated(EnumType.STRING)
    private MediaType mediaType = MediaType.TEXT;

    public enum MediaType { TEXT, VOICE }

    // Explicit message type instead of inferring "is this a reply" from
    // whether parentId happens to be set. NORMAL messages never have a
    // parentId; REPLY messages always do, at creation time, permanently —
    // it is never cleared, even after the parent is deleted (see below).
    @Builder.Default
    @Enumerated(EnumType.STRING)
    private MessageType type = MessageType.NORMAL;

    public enum MessageType { NORMAL, REPLY }

    // The id of the parent message for a REPLY. Deliberately a PLAIN
    // column — explicitly NOT a @ManyToOne/@JoinColumn, and there must
    // never be a foreign key constraint generated for it at the DB level
    // either. A real FK would force one of two behaviors when the parent
    // gets deleted: block the delete outright, or (ON DELETE SET NULL)
    // have Postgres itself silently erase this value out from under us —
    // which is exactly the bug that happened before this rewrite, because
    // an earlier version of this entity used @OnDelete(SET_NULL), which
    // leaves a real "ON DELETE SET NULL" constraint sitting on the table
    // that ddl-auto=update does NOT retroactively remove. If you're
    // migrating an existing DB, verify with:
    //   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
    //   WHERE conrelid = 'channel_messages'::regclass AND contype = 'f';
    // and drop any constraint on this column before this fix can work.
    //
    // parentId is set once at creation and never modified again — a
    // REPLY's parentId is permanent regardless of what happens to the
    // parent afterward. Whether the parent still exists is determined
    // purely at read time in ChannelService, by looking it up: found →
    // normal quote; not found → parentDeleted=true ("Original message was
    // deleted"). A parent that is itself a REPLY works with zero extra
    // logic — parentId is just an id, so reply-to-a-reply chains for free.
    private Long parentId;

    // User IDs parsed out of @username tokens in `content` at send time
    // (see ChannelService#parseMentions), scoped to members of this
    // network. Used client-side to decide whether to show the "this
    // pings you" highlight — see ChannelView.js. Not a FK relationship on
    // purpose: keeping this a plain id list means a mentioned user later
    // leaving the network (or the account being deleted) doesn't need any
    // cleanup here.
    @Builder.Default
    @ElementCollection
    @CollectionTable(name = "channel_message_mentions", joinColumns = @JoinColumn(name = "message_id"))
    @Column(name = "user_id")
    private List<Long> mentionedUserIds = new ArrayList<>();
}
