package net.omnimedia.omni.group.repository;

import net.omnimedia.omni.group.entity.GroupMessage;
import net.omnimedia.omni.group.entity.GroupMessageDelivery;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface GroupMessageDeliveryRepository extends JpaRepository<GroupMessageDelivery, Long> {

    boolean existsByGroupMessageIdAndUserId(Long groupMessageId, Long userId);

    /** [groupMessageId, number of members who have it] for every message whose LAST delivery is at or before cutoff. */
    @Query("SELECT d.groupMessageId, COUNT(d) FROM GroupMessageDelivery d " +
           "GROUP BY d.groupMessageId HAVING MAX(d.deliveredAt) <= :cutoff")
    List<Object[]> summaryLastDeliveredBefore(@Param("cutoff") LocalDateTime cutoff);

    /** Group messages (other than call-log rows) created at or before cutoff, delivered or not. */
    @Query("SELECT m FROM GroupMessage m WHERE m.createdAt <= :cutoff AND (m.type IS NULL OR m.type <> 'CALL')")
    List<GroupMessage> findGroupMessagesOlderThan(@Param("cutoff") LocalDateTime cutoff);

    @Modifying
    @Query("DELETE FROM GroupMessageDelivery d WHERE d.groupMessageId = :id")
    void deleteByGroupMessageId(@Param("id") Long id);
}
