package net.omnimedia.omni.comment.repository;

import net.omnimedia.omni.comment.entity.CommentVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface CommentVoteRepository extends JpaRepository<CommentVote, Long> {
    Optional<CommentVote> findByCommentIdAndUserId(Long commentId, Long userId);

    // Wipe every vote on a comment — needed before deleting the comment itself, since
    // votes from OTHER users have no DB-level cascade and would block the delete.
    void deleteAllByCommentId(Long commentId);

    // == Admin account deletion — wipe every vote this user cast ==
    @Modifying
    @Query("DELETE FROM CommentVote v WHERE v.user.id = :userId")
    void deleteAllByUserId(@Param("userId") Long userId);
}
