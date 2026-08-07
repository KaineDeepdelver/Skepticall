package net.omnimedia.omni.message.repository;

import net.omnimedia.omni.message.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    @Query("SELECT m FROM Message m WHERE " +
           "(m.sender.id = :u1 AND m.receiver.id = :u2) OR " +
           "(m.sender.id = :u2 AND m.receiver.id = :u1) " +
           "ORDER BY m.createdAt ASC")
    List<Message> findConversation(@Param("u1") Long u1, @Param("u2") Long u2);

    @Query("SELECT m FROM Message m WHERE " +
           "m.sender.id = :userId OR m.receiver.id = :userId " +
           "ORDER BY m.createdAt DESC")
    List<Message> findRecentConversations(@Param("userId") Long userId);

    /** Messages sent FROM fromUserId TO toUserId that are not yet READ */
    @Query("SELECT m FROM Message m WHERE " +
           "m.sender.id = :fromUserId AND m.receiver.id = :toUserId " +
           "AND (m.status IS NULL OR m.status <> 'READ')")
    List<Message> findUnreadMessages(@Param("fromUserId") Long fromUserId,
                                     @Param("toUserId")   Long toUserId);

    /** Count of unread messages sent FROM fromUserId TO toUserId */
    @Query("SELECT COUNT(m) FROM Message m WHERE " +
           "m.sender.id = :fromUserId AND m.receiver.id = :toUserId " +
           "AND (m.status IS NULL OR m.status <> 'READ')")
    long countUnreadMessages(@Param("fromUserId") Long fromUserId,
                             @Param("toUserId")   Long toUserId);

    /** TEMPO messages whose TTL has expired — used for scheduled cleanup. */
    @Query("SELECT m FROM Message m WHERE m.type = 'TEMPO' AND m.tempoExpiresAt IS NOT NULL AND m.tempoExpiresAt <= :now")
    List<Message> findExpiredTempoMessages(@Param("now") LocalDateTime now);

    // == Admin account deletion — wipe every message this user sent or received ==
    @Modifying
    @Query("DELETE FROM Message m WHERE m.sender.id = :userId OR m.receiver.id = :userId")
    void deleteAllForUser(@Param("userId") Long userId);
}
