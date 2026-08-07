package net.omnimedia.omni.post.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;

@Entity
@Table(name = "post_media")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder

public class PostMedia extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    // IMAGE | VIDEO | GIF
    @Column(nullable = false)
    private String mediaType;

    @Column(nullable = false)
    private String mediaUrl;

    // order within the post (0-based)
    @Column(nullable = false)
    private int position;
}
