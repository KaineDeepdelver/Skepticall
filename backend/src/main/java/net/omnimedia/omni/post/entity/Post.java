package net.omnimedia.omni.post.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;
import net.omnimedia.omni.user.entity.User;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "posts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder

public class Post extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    /**
     * URL-safe public identifier. Generated at creation time; never changes.
     * Nullable at the DB level only so Hibernate's ALTER TABLE can add the
     * column to a table with existing rows — SlugBackfill fills it in right
     * after, and PostService.create() always sets it for new rows.
     */
    @Column(unique = true)
    private String slug;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("position ASC")
    @Builder.Default
    private List<PostMedia> mediaItems = new ArrayList<>();

    @Builder.Default
    private int likeCount    = 0;

    @Builder.Default
    private int dislikeCount = 0;

    @Builder.Default
    private int commentCount = 0;
}
