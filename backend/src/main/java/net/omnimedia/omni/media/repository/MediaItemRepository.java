package net.omnimedia.omni.media.repository;

import net.omnimedia.omni.media.entity.MediaItem;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaItemRepository extends JpaRepository<MediaItem, Long> {
    Page<MediaItem> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<MediaItem> findByAuthorIdOrderByCreatedAtDesc(Long authorId, Pageable pageable);
    List<MediaItem> findByAuthorIdOrderByCreatedAtDesc(Long authorId);
    List<MediaItem> findByIsClipTrue();
    Page<MediaItem> findByIsClipFalseOrderByCreatedAtDesc(Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT m FROM MediaItem m WHERE LOWER(m.title) LIKE :q OR LOWER(m.description) LIKE :q ORDER BY m.createdAt DESC")
    List<MediaItem> searchByTitleOrDescription(@org.springframework.data.repository.query.Param("q") String q);
}
