package net.omnimedia.omni.group.repository;

import net.omnimedia.omni.group.entity.GroupMessageKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface GroupMessageKeyRepository extends JpaRepository<GroupMessageKey, Long> {

    List<GroupMessageKey> findByGroupMessageId(Long groupMessageId);

    // Batch fetch for a whole conversation's worth of messages in one
    // query instead of N+1 — getMessages() groups these back onto their
    // parent GroupMessageDTO by groupMessageId.
    List<GroupMessageKey> findByGroupMessageIdIn(List<Long> groupMessageIds);

    @Modifying
    @Query("DELETE FROM GroupMessageKey k WHERE k.groupMessage.id = :messageId")
    void deleteByGroupMessageId(@Param("messageId") Long messageId);

    // == Admin account deletion ==
    @Modifying
    @Query("DELETE FROM GroupMessageKey k WHERE k.recipient.id = :userId")
    void deleteAllForRecipient(@Param("userId") Long userId);
}
