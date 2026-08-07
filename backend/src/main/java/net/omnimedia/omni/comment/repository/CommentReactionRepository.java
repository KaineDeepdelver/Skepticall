package net.omnimedia.omni.comment.repository;

import net.omnimedia.omni.comment.entity.CommentReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface CommentReactionRepository extends JpaRepository<CommentReaction, Long> {
    List<CommentReaction> findByCommentId(Long commentId);
    List<CommentReaction> findByCommentIdAndUserId(Long commentId, Long userId);
    Optional<CommentReaction> findByCommentIdAndUserIdAndEmoji(Long commentId, Long userId, String emoji);

    @Query("SELECT r.emoji, COUNT(r) FROM CommentReaction r WHERE r.comment.id = :commentId GROUP BY r.emoji")
    List<Object[]> countByEmoji(Long commentId);

    // Wipe every reaction on a comment — needed before deleting the comment itself.
    void deleteAllByCommentId(Long commentId);

    // == Admin account deletion — wipe every reaction this user left ==
    @Modifying
    @Query("DELETE FROM CommentReaction r WHERE r.user.id = :userId")
    void deleteAllByUserId(Long userId);
}
