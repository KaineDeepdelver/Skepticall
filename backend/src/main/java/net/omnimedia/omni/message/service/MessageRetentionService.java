package net.omnimedia.omni.message.service;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.group.entity.GroupConversation;
import net.omnimedia.omni.group.entity.GroupMessage;
import net.omnimedia.omni.group.entity.GroupMessageDelivery;
import net.omnimedia.omni.group.repository.GroupConversationRepository;
import net.omnimedia.omni.group.repository.GroupMessageDeliveryRepository;
import net.omnimedia.omni.group.repository.GroupMessageKeyRepository;
import net.omnimedia.omni.group.repository.GroupMessageRepository;
import net.omnimedia.omni.message.dto.MessageDTO;
import net.omnimedia.omni.message.entity.Message;
import net.omnimedia.omni.message.mapper.MessageMapper;
import net.omnimedia.omni.message.repository.MessageRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * WhatsApp-style retention: the server is a delivery pipe, not the chat history.
 *
 *  - A message waits here until the receiver's device confirms it stored it (an "ack").
 *  - A few minutes after the ack it is deleted for good, together with its media in the bucket.
 *  - A message nobody ever collected is deleted after a maximum age.
 *  - Call-log rows are never purged.
 *
 * Text is also kept as a fast copy in Redis (msg:{id} + an inbox:{userId} index). The database
 * stays the durable copy, so a Redis restart or eviction can never lose a pending message: the
 * inbox is served from Redis only when it matches the database, otherwise from the database,
 * which then refills Redis.
 *
 * Purging is OFF unless messages.purge.enabled=true (env MESSAGES_PURGE_ENABLED), so this can be
 * deployed first and switched on once the apps keep their own history.
 */
@Service
@RequiredArgsConstructor
public class MessageRetentionService {

    private static final String MSG_KEY = "msg:";
    private static final String INBOX_KEY = "inbox:";

    private final MessageRepository messageRepo;
    private final MessageMapper messageMapper;
    private final GroupMessageRepository groupMessageRepo;
    private final GroupMessageKeyRepository groupKeyRepo;
    private final GroupMessageDeliveryRepository deliveryRepo;
    private final GroupConversationRepository groupRepo;
    private final StringRedisTemplate redis;

    // Own mapper (not the injected one) so LocalDateTime round-trips as ISO text whatever the app-wide
    // Jackson setup is. If the java-time module isn't available, caching quietly does nothing and the
    // inbox is served from the database.
    private final ObjectMapper objectMapper = new ObjectMapper()
            .findAndRegisterModules()
            .configure(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS, false)
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    @Value("${messages.purge.delivered-after-minutes:5}")
    private int deliveredAfterMinutes;

    @Value("${messages.purge.max-pending-days:30}")
    private int maxPendingDays;

    public record PurgeResult(List<String> mediaUrls, int dms, int groups) {}

    // == Redis fast copy (best effort) =========================================

    /** A newly saved DM: store the fast copy and add it to the receiver's pending index. */
    public void cacheNew(MessageDTO dto) {
        if (dto == null || dto.getId() == null || dto.getReceiverId() == null) return;
        if ("CALL".equals(dto.getType())) return;
        try {
            redis.opsForValue().set(MSG_KEY + dto.getId(), objectMapper.writeValueAsString(dto),
                    Duration.ofDays(maxPendingDays));
            redis.opsForZSet().add(INBOX_KEY + dto.getReceiverId(), String.valueOf(dto.getId()),
                    System.currentTimeMillis());
        } catch (Exception ignored) {
            // Redis is only a cache
        }
    }

    /** An edit or delete: refresh the fast copy only if it is still cached. */
    public void refreshCached(MessageDTO dto) {
        if (dto == null || dto.getId() == null) return;
        try {
            if (Boolean.TRUE.equals(redis.hasKey(MSG_KEY + dto.getId()))) {
                redis.opsForValue().set(MSG_KEY + dto.getId(), objectMapper.writeValueAsString(dto),
                        Duration.ofDays(maxPendingDays));
            }
        } catch (Exception ignored) {
            // Redis is only a cache
        }
    }

    private void evict(Long messageId, Long receiverId) {
        try {
            redis.delete(MSG_KEY + messageId);
            if (receiverId != null) redis.opsForZSet().remove(INBOX_KEY + receiverId, String.valueOf(messageId));
        } catch (Exception ignored) {
            // Redis is only a cache
        }
    }

    // == Inbox (DMs this user's device hasn't collected yet) ====================

    public List<MessageDTO> inboxFor(Long userId) {
        long dbCount = messageRepo.countUndeliveredFor(userId);
        try {
            Set<String> ids = redis.opsForZSet().range(INBOX_KEY + userId, 0, -1);
            if (ids != null && ids.size() == dbCount) {
                List<MessageDTO> out = new ArrayList<>();
                boolean complete = true;
                for (String id : ids) {
                    String json = redis.opsForValue().get(MSG_KEY + id);
                    if (json == null) { complete = false; break; }
                    out.add(objectMapper.readValue(json, MessageDTO.class));
                }
                if (complete) return out;
            }
        } catch (Exception ignored) {
            // fall through to the database
        }
        List<MessageDTO> fromDb = messageRepo.findUndeliveredFor(userId).stream()
                .map(messageMapper::toDTO).collect(Collectors.toList());
        fromDb.forEach(this::cacheNew);
        return fromDb;
    }

    // == Delivery acks ==========================================================

    /** Receiver's device stored these DMs. Returns senderId -> ids, so each sender can be told. */
    @Transactional
    public Map<Long, List<Long>> markDelivered(Long receiverId, List<Long> ids) {
        Map<Long, List<Long>> bySender = new LinkedHashMap<>();
        if (ids == null || ids.isEmpty()) return bySender;
        List<Message> changed = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        for (Message m : messageRepo.findAllById(ids)) {
            if (m.getReceiver() == null || !receiverId.equals(m.getReceiver().getId())) continue;
            if (m.getDeliveredAt() != null) continue;
            m.setDeliveredAt(now);
            if (m.getStatus() == null || "SENT".equals(m.getStatus())) m.setStatus("DELIVERED");
            changed.add(m);
            if (m.getSender() != null) {
                bySender.computeIfAbsent(m.getSender().getId(), k -> new ArrayList<>()).add(m.getId());
            }
        }
        messageRepo.saveAll(changed);
        for (Message m : changed) {
            try {
                redis.opsForZSet().remove(INBOX_KEY + receiverId, String.valueOf(m.getId()));
            } catch (Exception ignored) {
                // Redis is only a cache
            }
        }
        return bySender;
    }

    /** A group member's device stored these group messages. Returns the ids newly recorded. */
    @Transactional
    public List<Long> markGroupDelivered(Long userId, Long groupId, List<Long> ids) {
        List<Long> acked = new ArrayList<>();
        if (ids == null || ids.isEmpty()) return acked;
        GroupConversation g = groupRepo.findById(groupId).orElse(null);
        if (g == null || g.getMembers().stream().noneMatch(u -> userId.equals(u.getId()))) return acked;
        LocalDateTime now = LocalDateTime.now();
        for (GroupMessage gm : groupMessageRepo.findAllById(ids)) {
            if (gm.getGroup() == null || !groupId.equals(gm.getGroup().getId())) continue;
            if (gm.getSender() != null && userId.equals(gm.getSender().getId())) continue;
            if ("CALL".equals(gm.getType())) continue;
            if (deliveryRepo.existsByGroupMessageIdAndUserId(gm.getId(), userId)) continue;
            deliveryRepo.save(GroupMessageDelivery.builder()
                    .groupMessageId(gm.getId()).userId(userId).deliveredAt(now).build());
            acked.add(gm.getId());
        }
        return acked;
    }

    // == Purge ==================================================================

    /** Deletes everything that is due. Returns the media URLs so the caller can remove them from the bucket. */
    @Transactional
    public PurgeResult purgeNow() {
        LocalDateTime now = LocalDateTime.now();
        List<String> urls = new ArrayList<>();

        // Direct messages: delivered long enough ago, or never collected and too old.
        List<Message> doomed = new ArrayList<>(messageRepo.findPurgeable(now.minusMinutes(deliveredAfterMinutes)));
        doomed.addAll(messageRepo.findExpiredUndelivered(now.minusDays(maxPendingDays)));
        for (Message m : doomed) {
            if (m.getFileUrl() != null) urls.add(m.getFileUrl());
            evict(m.getId(), m.getReceiver() != null ? m.getReceiver().getId() : null);
        }
        messageRepo.deleteAll(doomed);

        // Group messages: every member except the sender has it, and the last one got it long enough ago.
        int groups = 0;
        LocalDateTime cutoff = now.minusMinutes(deliveredAfterMinutes);
        for (Object[] row : deliveryRepo.summaryLastDeliveredBefore(cutoff)) {
            Long gmId = ((Number) row[0]).longValue();
            long delivered = ((Number) row[1]).longValue();
            GroupMessage gm = groupMessageRepo.findById(gmId).orElse(null);
            if (gm == null) { deliveryRepo.deleteByGroupMessageId(gmId); continue; }
            if ("CALL".equals(gm.getType())) continue;
            int recipients = gm.getGroup() == null ? 0 : Math.max(0, gm.getGroup().getMembers().size() - 1);
            if (delivered >= recipients) {
                purgeGroupMessage(gm, urls);
                groups++;
            }
        }
        // Group messages nobody finished collecting within the max age.
        for (GroupMessage gm : deliveryRepo.findGroupMessagesOlderThan(now.minusDays(maxPendingDays))) {
            purgeGroupMessage(gm, urls);
            groups++;
        }
        return new PurgeResult(urls, doomed.size(), groups);
    }

    private void purgeGroupMessage(GroupMessage gm, List<String> urls) {
        if (gm.getFileUrl() != null) urls.add(gm.getFileUrl());
        groupKeyRepo.deleteByGroupMessageId(gm.getId());
        deliveryRepo.deleteByGroupMessageId(gm.getId());
        groupMessageRepo.delete(gm);
    }
}
