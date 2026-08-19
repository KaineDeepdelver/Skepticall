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

    @Builder.Default
    private Boolean edited = false;

    // The id of the message this one is replying to, Discord-style.
    // Deliberately a plain column, NOT a @ManyToOne/@JoinColumn FK. If it
    // were a real FK, deleting the original message would either be
    // blocked by the constraint or (with ON DELETE SET NULL) silently
    // erase the fact that this was ever a reply. Neither matches Discord,
    // which keeps the reference and shows "original message was deleted"
    // once the target is gone. ChannelService resolves this id manually
    // via a repository lookup and reports replyToDeleted=true in the DTO
    // when that lookup comes back empty.
    private Long replyToId;

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
