package net.omnimedia.omni.group.repository;
import net.omnimedia.omni.group.entity.GroupMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
public interface GroupMessageRepository extends JpaRepository<GroupMessage, Long> {
    List<GroupMessage> findByGroupIdOrderByCreatedAtAsc(Long groupId);

    // Looks up the call-log row a /call.group.end should flip to ENDED.
    // Most-recent-first in case a callId were ever reused (shouldn't
    // happen — callId is timestamp-derived — but this is the safe read).
    Optional<GroupMessage> findFirstByGroupIdAndCallIdOrderByIdDesc(Long groupId, String callId);

    // == Admin account deletion — wipe every group message this user sent ==
    @Modifying
    @Query("DELETE FROM GroupMessage m WHERE m.sender.id = :userId")
    void deleteAllBySenderId(@Param("userId") Long userId);
}
