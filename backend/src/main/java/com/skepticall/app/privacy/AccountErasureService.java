package com.skepticall.app.privacy;

import com.skepticall.app.config.R2StorageService;
import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.exceptions.ErrorType;
import com.skepticall.app.group.entity.GroupConversation;
import com.skepticall.app.user.entity.User;
import com.skepticall.app.user.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Right to erasure: removes an account and everything tied to it.
 *
 * <p>The database rows go in one transaction (everything or nothing). The files in object storage
 * can't join a transaction, so {@link #erase} returns their URLs and the caller deletes them with
 * {@link #deleteFiles} after the commit.
 *
 * <p>Messages are removed from BOTH sides of a conversation: the server only holds them in transit,
 * and the other person's copy lives on their device. Groups the person created pass to another
 * member, or are deleted if nobody is left.
 */
@Service
public class AccountErasureService {

    private static final Logger LOG = LoggerFactory.getLogger(AccountErasureService.class);
    private static final String MSG_KEY = "msg:";
    private static final String INBOX_KEY = "inbox:";

    private final EntityManager em;
    private final UserRepository userRepository;
    private final StringRedisTemplate redis;
    private final R2StorageService r2;
    private final CacheManager cacheManager;

    public AccountErasureService(EntityManager em, UserRepository userRepository, StringRedisTemplate redis,
                                 R2StorageService r2, CacheManager cacheManager) {
        this.em = em;
        this.userRepository = userRepository;
        this.redis = redis;
        this.r2 = r2;
        this.cacheManager = cacheManager;
    }

    /** Deletes the account's data. Returns the object-storage files to delete once this has committed. */
    @Transactional
    public List<String> erase(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User profile not found [id=" + userId + "]"));

        List<String> files = new ArrayList<>();
        addFile(files, user.getProfilePicture());
        addFile(files, user.getBannerPicture());

        // == 1:1 messages (both directions) ======================================
        List<Object[]> dms = em.createQuery(
                "select m.id, m.receiver.id, m.fileUrl from Message m where m.sender.id = :id or m.receiver.id = :id",
                Object[].class).setParameter("id", userId).getResultList();
        for (Object[] row : dms) {
            addFile(files, (String) row[2]);
            dropFromRedis((Long) row[0], (Long) row[1]);
        }

        // == Groups ==============================================================
        // Files of the person's own group messages
        files.addAll(em.createQuery("select g.fileUrl from GroupMessage g where g.sender.id = :id and g.fileUrl is not null",
                String.class).setParameter("id", userId).getResultList());

        em.createQuery("delete from GroupMessageKey k where k.recipient.id = :id").setParameter("id", userId).executeUpdate();
        em.createQuery("delete from GroupMessageKey k where k.groupMessage.id in "
                + "(select g.id from GroupMessage g where g.sender.id = :id)").setParameter("id", userId).executeUpdate();
        em.createQuery("delete from GroupMessageDelivery d where d.userId = :id or d.groupMessageId in "
                + "(select g.id from GroupMessage g where g.sender.id = :id)").setParameter("id", userId).executeUpdate();
        em.createQuery("delete from GroupMessage g where g.sender.id = :id").setParameter("id", userId).executeUpdate();

        List<GroupConversation> groups = em.createQuery(
                "select distinct c from GroupConversation c left join c.members m where m.id = :id or c.creator.id = :id",
                GroupConversation.class).setParameter("id", userId).getResultList();
        for (GroupConversation group : groups) {
            group.getMembers().removeIf(m -> m.getId().equals(userId));
            if (group.getMembers().isEmpty()) {
                deleteGroupCompletely(group, files);
            } else if (group.getCreator() != null && group.getCreator().getId().equals(userId)) {
                group.setCreator(group.getMembers().get(0)); // the group lives on with another member in charge
            }
        }
        em.flush();

        // == Everything else that points at the person ==========================
        em.createQuery("delete from Message m where m.sender.id = :id or m.receiver.id = :id").setParameter("id", userId).executeUpdate();
        em.createQuery("delete from FriendRequest f where f.sender.id = :id or f.receiver.id = :id").setParameter("id", userId).executeUpdate();
        em.createQuery("delete from Notification n where n.recipient.id = :id or n.actor.id = :id").setParameter("id", userId).executeUpdate();
        em.createQuery("delete from PushToken t where t.userId = :id").setParameter("id", userId).executeUpdate();
        em.createQuery("delete from Admin a where a.user.id = :id").setParameter("id", userId).executeUpdate();
        em.createQuery("delete from UserPublicKey k where k.userId = :id").setParameter("id", userId).executeUpdate();

        em.flush();
        em.clear();
        userRepository.deleteById(userId);

        try { redis.delete(INBOX_KEY + userId); } catch (Exception e) { LOG.warn("[erasure] redis cleanup failed: {}", e.toString()); }
        Cache users = cacheManager.getCache("users");
        if (users != null) users.evict(userId);
        LOG.info("[erasure] account {} erased ({} files queued for deletion)", userId, files.size());
        return files;
    }

    /** Deletes the files in object storage. Call after {@link #erase} has committed; failures are logged, not thrown. */
    public void deleteFiles(List<String> urls) {
        for (String url : urls) {
            try { r2.deleteByUrl(url); } catch (Exception e) { LOG.warn("[erasure] could not delete file {}: {}", url, e.toString()); }
        }
    }

    private void deleteGroupCompletely(GroupConversation group, List<String> files) {
        Long gid = group.getId();
        files.addAll(em.createQuery("select g.fileUrl from GroupMessage g where g.group.id = :gid and g.fileUrl is not null",
                String.class).setParameter("gid", gid).getResultList());
        addFile(files, group.getAvatarUrl());
        em.createQuery("delete from GroupMessageKey k where k.groupMessage.id in (select g.id from GroupMessage g where g.group.id = :gid)")
                .setParameter("gid", gid).executeUpdate();
        em.createQuery("delete from GroupMessageDelivery d where d.groupMessageId in (select g.id from GroupMessage g where g.group.id = :gid)")
                .setParameter("gid", gid).executeUpdate();
        em.createQuery("delete from GroupMessage g where g.group.id = :gid").setParameter("gid", gid).executeUpdate();
        em.remove(group);
    }

    private void dropFromRedis(Long messageId, Long receiverId) {
        try {
            redis.delete(MSG_KEY + messageId);
            if (receiverId != null) redis.opsForZSet().remove(INBOX_KEY + receiverId, String.valueOf(messageId));
        } catch (Exception e) {
            LOG.warn("[erasure] redis cleanup failed: {}", e.toString());
        }
    }

    private static void addFile(List<String> files, String url) {
        if (url != null && !url.isBlank()) files.add(url);
    }
}
