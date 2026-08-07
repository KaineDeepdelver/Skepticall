package net.omnimedia.omni.comment.repository;

import net.omnimedia.omni.comment.entity.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    // Top-level only (parentId IS NULL)
    @Query("SELECT c FROM Comment c WHERE c.postId = :postId AND c.parentId IS NULL ORDER BY c.createdAt ASC")
    List<Comment> findTopLevelByPostId(@Param("postId") Long postId);

    @Query("SELECT c FROM Comment c WHERE c.mediaId = :mediaId AND c.parentId IS NULL ORDER BY c.createdAt ASC")
    List<Comment> findTopLevelByMediaId(@Param("mediaId") Long mediaId);

    // For old calls still used by getForPost/getForMedia (keep for compat)
    List<Comment> findByPostIdOrderByCreatedAtAsc(Long postId);
    List<Comment> findByMediaIdOrderByCreatedAtAsc(Long mediaId);
    List<Comment> findByParentIdOrderByCreatedAtAsc(Long parentId);

    long countByParentId(Long parentId);

    // == Admin account deletion — find every comment this user wrote ==
    List<Comment> findByAuthorId(Long authorId);
}
