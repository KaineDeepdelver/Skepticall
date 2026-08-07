package net.omnimedia.omni.notification.repository;

import net.omnimedia.omni.notification.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByRecipientIdOrderByCreatedAtDesc(Long recipientId);

    long countByRecipientIdAndReadFalse(Long recipientId);

    @Query("SELECT COUNT(n) FROM Notification n WHERE n.recipient.id = :recipientId AND n.actor.id = :actorId AND n.type = 'MESSAGE' AND n.read = false")
    long countUnreadMessagesFromActor(Long recipientId, Long actorId);

    @Query("SELECT COUNT(n) FROM Notification n WHERE n.recipient.id = :recipientId AND n.actor.id = :actorId AND n.type = 'CALL' AND n.read = false")
    long countUnreadCallsFromActor(Long recipientId, Long actorId);

    @Query("SELECT COUNT(n) FROM Notification n WHERE n.recipient.id = :recipientId AND n.actor.id = :actorId AND n.type = 'VIDEO_CALL' AND n.read = false")
    long countUnreadVideoCallsFromActor(Long recipientId, Long actorId);

    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.recipient.id = :recipientId")
    void markAllRead(Long recipientId);

    // == Admin account deletion — wipe every notification this user triggered or received ==
    @Modifying
    @Query("DELETE FROM Notification n WHERE n.recipient.id = :userId OR n.actor.id = :userId")
    void deleteAllForUser(Long userId);
}
