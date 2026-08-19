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

    // "NORMAL" or "REPLY" — explicit, not inferred from parentId being
    // non-null. A REPLY always has parentId set, permanently, even after
    // the parent is deleted (see ChannelMessage.parentId for why).
    private String type;

    // Parent preview — populated only when type == "REPLY". parentContent
    // is truncated (see ChannelService) so the quoted strip in the UI
    // can't blow up into a wall of text. parentDeleted is true when
    // parentId is set but that message no longer exists — mirrors
    // Discord's "Original message was deleted" treatment.
    private Long parentId;
    private boolean parentDeleted;
    private Long parentAuthorId;
    private String parentAuthorUsername;
    private String parentAuthorDisplayName;
    private String parentAuthorAvatar;
    private String parentContent;

    // User IDs @mentioned in `content`, scoped to this network's members.
    // The client compares this (and parentAuthorId) against its own user
    // id to decide whether to show the "this pings you" highlight — see
    // ChannelView.js. Deliberately not computed per-viewer server-side,
    // since this DTO is broadcast once over the channel's WS topic to
    // every member at once.
    @Builder.Default
    private List<Long> mentionedUserIds = new ArrayList<>();
}
