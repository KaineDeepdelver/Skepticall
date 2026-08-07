package net.omnimedia.omni.post.repository;

import net.omnimedia.omni.post.entity.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PostRepository extends JpaRepository<Post, Long> {
    Optional<Post> findBySlug(String slug);
    Page<Post> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<Post> findByAuthorIdOrderByCreatedAtDesc(Long authorId, Pageable pageable);
    List<Post> findByAuthorId(Long authorId);

    @Query("SELECT p FROM Post p WHERE LOWER(p.content) LIKE :q ORDER BY p.createdAt DESC")
    List<Post> searchByContent(@Param("q") String q);
}
