package net.omnimedia.omni.post.repository;

import net.omnimedia.omni.post.entity.PostVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface PostVoteRepository extends JpaRepository<PostVote, Long> {
    Optional<PostVote> findByPostIdAndUserId(Long postId, Long userId);
    void deleteByPostIdAndUserId(Long postId, Long userId);

    // Wipe every vote on a post — needed before deleting the post itself, since
    // votes from OTHER users have no DB-level cascade and would block the delete.
    void deleteAllByPostId(Long postId);

    // == Admin account deletion — wipe every vote this user cast ==
    @Modifying
    @Query("DELETE FROM PostVote v WHERE v.user.id = :userId")
    void deleteAllByUserId(@Param("userId") Long userId);
}
