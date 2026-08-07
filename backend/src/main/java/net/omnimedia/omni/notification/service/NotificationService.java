package net.omnimedia.omni.notification.service;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.follow.repository.FollowRepository;
import net.omnimedia.omni.notification.dto.NotificationDTO;
import net.omnimedia.omni.notification.entity.Notification;
import net.omnimedia.omni.notification.repository.NotificationRepository;
import net.omnimedia.omni.user.entity.User;
import net.omnimedia.omni.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notifRepo;
    private final FollowRepository       followRepo;
    private final UserRepository         userRepo;

    // ── followers (POST / MEDIA) ──────────────────────────────────────────────

    @Transactional
    public void notifyFollowers(Long actorId, String type, Long refId, String refSlug, String preview) {
        User actor = userRepo.findById(actorId).orElse(null);
        if (actor == null) return;
        followRepo.findByFollowingId(actorId).forEach(follow -> {
            User recipient = follow.getFollower();
            if (recipient.getId().equals(actorId)) return;
            notifRepo.save(Notification.builder()
                .recipient(recipient).actor(actor)
                .type(type).refId(refId).refSlug(refSlug).preview(preview)
                .build());
        });
    }

    // ── direct messages ───────────────────────────────────────────────────────

    /** TEXT message — groups with previous unread from same actor */
    @Transactional
    public void notifyMessage(Long actorId, Long recipientId, Long refId, String preview) {
        save(actorId, recipientId, "MESSAGE", refId, preview);
    }

    /** VOICE message */
    @Transactional
    public void notifyVoiceMessage(Long actorId, Long recipientId, Long refId) {
        save(actorId, recipientId, "VOICE_MESSAGE", refId, null);
    }

    /** Reply to a text message */
    @Transactional
    public void notifyReply(Long actorId, Long recipientId, Long refId, String preview) {
        save(actorId, recipientId, "REPLY", refId, preview);
    }

    /** Reply to a voice message */
    @Transactional
    public void notifyVoiceReply(Long actorId, Long recipientId, Long refId) {
        save(actorId, recipientId, "VOICE_REPLY", refId, null);
    }

    // ── calls ─────────────────────────────────────────────────────────────────

    @Transactional
    public void notifyCall(Long actorId, Long recipientId) {
        save(actorId, recipientId, "CALL", null, null);
    }

    @Transactional
    public void notifyVideoCall(Long actorId, Long recipientId) {
        save(actorId, recipientId, "VIDEO_CALL", null, null);
    }

    // ── follow ────────────────────────────────────────────────────────────────

    @Transactional
    public void notifyFollow(Long actorId, Long recipientId) {
        save(actorId, recipientId, "FOLLOW", null, null);
    }

    // ── read / fetch ──────────────────────────────────────────────────────────

    public List<NotificationDTO> getForUser(Long userId) {
        return notifRepo.findByRecipientIdOrderByCreatedAtDesc(userId)
            .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public long getUnreadCount(Long userId) {
        return notifRepo.countByRecipientIdAndReadFalse(userId);
    }

    @Transactional
    public void markAllRead(Long userId) {
        notifRepo.markAllRead(userId);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void save(Long actorId, Long recipientId, String type, Long refId, String preview) {
        User actor     = userRepo.findById(actorId).orElse(null);
        User recipient = userRepo.findById(recipientId).orElse(null);
        if (actor == null || recipient == null) return;
        notifRepo.save(Notification.builder()
            .recipient(recipient).actor(actor)
            .type(type).refId(refId).preview(preview)
            .build());
    }

    private NotificationDTO toDTO(Notification n) {
        String name = n.getActor().getDisplayName() != null
            ? n.getActor().getDisplayName() : n.getActor().getUsername();

        // ── inbox display text ──────────────────────────────────────────────
        // For grouped message counts we query unread count from this actor
        String text = switch (n.getType()) {
            case "MESSAGE" -> {
                long cnt = notifRepo.countUnreadMessagesFromActor(
                    n.getRecipient().getId(), n.getActor().getId());
                yield cnt > 1
                    ? "You have " + cnt + " messages from " + name
                    : "You have a message from " + name;
            }
            case "VOICE_MESSAGE" -> "You have a voice message from " + name;
            case "REPLY" -> name + " replied to your message";
            case "VOICE_REPLY" -> name + " replied to your voice message";
            case "CALL" -> {
                long cnt = notifRepo.countUnreadCallsFromActor(
                    n.getRecipient().getId(), n.getActor().getId());
                yield cnt > 1
                    ? name + " has called you " + cnt + " times"
                    : name + " has called you";
            }
            case "VIDEO_CALL" -> {
                long cnt = notifRepo.countUnreadVideoCallsFromActor(
                    n.getRecipient().getId(), n.getActor().getId());
                yield cnt > 1
                    ? name + " has video called you " + cnt + " times"
                    : name + " has video called you";
            }
            case "POST"    -> name + " has posted recently";
            case "MEDIA"   -> name + " has uploaded recently";
            case "FOLLOW"  -> name + " started following you";
            default        -> name + " sent you a notification";
        };

        NotificationDTO dto = new NotificationDTO();
        dto.setId(n.getId());
        dto.setType(n.getType());
        dto.setRefId(n.getRefId());
        dto.setRefSlug(n.getRefSlug());
        dto.setPreview(n.getPreview());
        dto.setText(text);
        dto.setRead(n.isRead());
        dto.setCreatedAt(n.getCreatedAt());
        dto.setActorId(n.getActor().getId());
        dto.setActorUsername(n.getActor().getUsername());
        dto.setActorDisplayName(n.getActor().getDisplayName());
        dto.setActorAvatar(n.getActor().getProfilePicture());
        return dto;
    }
}
