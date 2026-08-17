package net.omnimedia.omni.network.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;
import net.omnimedia.omni.user.entity.User;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

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

    // The message this one is replying to, Discord-style. Nullable — most
    // messages aren't replies. @OnDelete(SET_NULL) means if the replied-to
    // message is later deleted, this FK is nulled out at the DB level
    // instead of blocking the delete (or cascading and wiping this reply
    // out too, which would be wrong — the reply itself is still a real
    // message and should survive with its quote just gone).
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reply_to_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private ChannelMessage replyTo;

    // User IDs parsed out of @username tokens in `content` at send time
    // (see ChannelService#parseMentions), scoped to members of this
    // network. Used client-side to decide whether to show the "this
    // pings you" highlight — see ChannelView.js. Not a FK relationship on
    // purpose: keeping this a plain id list means a mentioned user later
    // leaving the network (or the account being deleted) doesn't need any
    // cleanup here, unlike author/replyTo which are real associations.
    @Builder.Default
    @ElementCollection
    @CollectionTable(name = "channel_message_mentions", joinColumns = @JoinColumn(name = "message_id"))
    @Column(name = "user_id")
    private List<Long> mentionedUserIds = new ArrayList<>();
}
