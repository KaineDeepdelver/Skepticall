package net.omnimedia.omni.network.dto;

import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChannelMessageDTO {
    private Long id;
    private Long channelId;
    private Long authorId;
    private String authorUsername;
    private String authorDisplayName;
    private String authorAvatar;
    private String authorRoleColor; // highest-position role's colour for this author in this network; null = default text colour
    private String content;
    private String fileUrl;
    private Boolean edited;
    private LocalDateTime createdAt;
    private String _tmpId; // optimistic-send correlation, mirrors GroupMessageDTO

    // Reply-to preview — populated only when this message is a reply.
    // replyToContent is truncated (see ChannelService) so the quoted strip
    // in the UI can't blow up into a wall of text. replyToDeleted is true
    // when replyToId is set but the referenced message no longer exists
    // (it was deleted) — mirrors Discord's "Original message was deleted"
    // treatment instead of silently dropping the quote.
    private Long replyToId;
    private boolean replyToDeleted;
    private Long replyToAuthorId;
    private String replyToAuthorUsername;
    private String replyToAuthorDisplayName;
    private String replyToContent;

    // User IDs @mentioned in `content`, scoped to this network's members.
    // The client compares this (and replyToAuthorId) against its own user
    // id to decide whether to show the "this pings you" highlight — see
    // ChannelView.js. Deliberately not computed per-viewer server-side,
    // since this DTO is broadcast once over the channel's WS topic to
    // every member at once.
    @Builder.Default
    private List<Long> mentionedUserIds = new ArrayList<>();
}
