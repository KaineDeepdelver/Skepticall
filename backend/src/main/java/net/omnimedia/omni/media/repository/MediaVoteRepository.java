package net.omnimedia.omni.media.repository;

import net.omnimedia.omni.media.entity.MediaVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface MediaVoteRepository extends JpaRepository<MediaVote, Long> {
    Optional<MediaVote> findByMediaIdAndUserId(Long mediaId, Long userId);
    void deleteByMediaIdAndUserId(Long mediaId, Long userId);

    // Wipe every vote on a media item — needed before deleting the item itself, since
    // votes from OTHER users have no DB-level cascade and would block the delete.
    void deleteAllByMediaId(Long mediaId);

    // == Admin account deletion — wipe every vote this user cast ==
    @Modifying
    @Query("DELETE FROM MediaVote v WHERE v.user.id = :userId")
    void deleteAllByUserId(@Param("userId") Long userId);
}
