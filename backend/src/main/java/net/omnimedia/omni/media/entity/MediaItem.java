package net.omnimedia.omni.media.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;
import net.omnimedia.omni.user.entity.User;

@Entity @Table(name = "media_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MediaItem extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    // VIDEO only
    @Column(nullable = false)
    private String videoUrl;

    private String thumbnailUrl;

    @Builder.Default private int likeCount    = 0;
    @Builder.Default private int dislikeCount = 0;
    @Builder.Default private int commentCount = 0;
    @Builder.Default private int viewCount    = 0;

    /** true = short-form vertical Clip (≤ 5 min); false = regular video */
    @org.hibernate.annotations.ColumnDefault("false")
    @Builder.Default private boolean isClip = false;

    /** Duration in seconds, set at upload time from the video metadata */
    @org.hibernate.annotations.ColumnDefault("0")
    @Builder.Default private int durationSeconds = 0;
}
