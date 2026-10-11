package com.skepticall.app.message.service;

import com.skepticall.app.group.entity.GroupConversation;
import com.skepticall.app.group.entity.GroupMessage;
import com.skepticall.app.group.repository.GroupConversationRepository;
import com.skepticall.app.group.repository.GroupMessageDeliveryRepository;
import com.skepticall.app.group.repository.GroupMessageKeyRepository;
import com.skepticall.app.group.repository.GroupMessageRepository;
import com.skepticall.app.message.entity.Message;
import com.skepticall.app.message.mapper.MessageMapper;
import com.skepticall.app.message.repository.MessageRepository;
import com.skepticall.app.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The server is a delivery pipe: these tests pin down when a message is allowed to
 * be deleted (after the receiver's ack + delay, or after the max pending age) and
 * that nothing is deleted before everyone has it.
 */
class MessageRetentionServiceTest {

    private MessageRepository messageRepo;
    private GroupMessageRepository groupMessageRepo;
    private GroupMessageKeyRepository groupKeyRepo;
    private GroupMessageDeliveryRepository deliveryRepo;
    private GroupConversationRepository groupRepo;
    private MessageRetentionService service;

    @BeforeEach
    void setUp() {
        messageRepo = mock(MessageRepository.class);
        groupMessageRepo = mock(GroupMessageRepository.class);
        groupKeyRepo = mock(GroupMessageKeyRepository.class);
        deliveryRepo = mock(GroupMessageDeliveryRepository.class);
        groupRepo = mock(GroupConversationRepository.class);

        service = new MessageRetentionService(
                messageRepo,
                mock(MessageMapper.class),
                groupMessageRepo,
                groupKeyRepo,
                deliveryRepo,
                groupRepo,
                mock(StringRedisTemplate.class));
        ReflectionTestUtils.setField(service, "deliveredAfterMinutes", 5);
        ReflectionTestUtils.setField(service, "maxPendingDays", 30);

        // Nothing is due by default; each test overrides what it cares about.
        when(messageRepo.findPurgeable(any())).thenReturn(new ArrayList<>());
        when(messageRepo.findExpiredUndelivered(any())).thenReturn(new ArrayList<>());
        when(deliveryRepo.summaryLastDeliveredBefore(any())).thenReturn(new ArrayList<>());
        when(deliveryRepo.findGroupMessagesOlderThan(any())).thenReturn(new ArrayList<>());
    }

    private static User user(long id) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    // == Purge: direct messages =================================================

    @Test
    void deliveredDirectMessageIsDeletedWithItsMedia() {
        Message m = new Message();
        m.setFileUrl("https://bucket.example/encrypted.bin");
        when(messageRepo.findPurgeable(any())).thenReturn(new ArrayList<>(List.of(m)));

        MessageRetentionService.PurgeResult result = service.purgeNow();

        assertEquals(1, result.dms());
        assertEquals(List.of("https://bucket.example/encrypted.bin"), result.mediaUrls());
        verify(messageRepo).deleteAll(List.of(m));
    }

    @Test
    void deliveredMessagesBecomePurgeableAfterFiveMinutes() {
        service.purgeNow();

        ArgumentCaptor<LocalDateTime> cutoff = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(messageRepo).findPurgeable(cutoff.capture());
        long seconds = Duration.between(cutoff.getValue(), LocalDateTime.now()).toSeconds();
        assertTrue(seconds >= 299 && seconds <= 305, "cutoff should be ~5 minutes ago, was " + seconds + "s");
    }

    @Test
    void neverCollectedMessagesExpireAfterThirtyDays() {
        service.purgeNow();

        ArgumentCaptor<LocalDateTime> cutoff = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(messageRepo).findExpiredUndelivered(cutoff.capture());
        long days = Duration.between(cutoff.getValue(), LocalDateTime.now()).toDays();
        assertEquals(30, days);
    }

    @Test
    void purgeDoesNothingWhenNothingIsDue() {
        MessageRetentionService.PurgeResult result = service.purgeNow();

        assertEquals(0, result.dms());
        assertEquals(0, result.groups());
        assertTrue(result.mediaUrls().isEmpty());
    }

    // == Purge: group messages ==================================================

    private GroupMessage groupMessageWithMembers(int members) {
        List<User> users = new ArrayList<>();
        for (int i = 1; i <= members; i++) users.add(user(i));
        GroupConversation group = GroupConversation.builder().members(users).build();
        GroupMessage gm = GroupMessage.builder().group(group).fileUrl("https://bucket.example/g.bin").build();
        when(groupMessageRepo.findById(1L)).thenReturn(Optional.of(gm));
        return gm;
    }

    private void deliveredToCount(long count) {
        List<Object[]> rows = new ArrayList<>();
        rows.add(new Object[]{1L, count});
        when(deliveryRepo.summaryLastDeliveredBefore(any())).thenReturn(rows);
    }

    @Test
    void groupMessageIsKeptUntilEveryRecipientHasIt() {
        // 3 members = 2 recipients (the sender doesn't count); only 1 has collected it
        GroupMessage gm = groupMessageWithMembers(3);
        deliveredToCount(1);

        MessageRetentionService.PurgeResult result = service.purgeNow();

        assertEquals(0, result.groups());
        verify(groupMessageRepo, never()).delete(gm);
    }

    @Test
    void groupMessageIsDeletedOnceEveryRecipientHasIt() {
        GroupMessage gm = groupMessageWithMembers(3);
        deliveredToCount(2);

        MessageRetentionService.PurgeResult result = service.purgeNow();

        assertEquals(1, result.groups());
        assertEquals(List.of("https://bucket.example/g.bin"), result.mediaUrls());
        verify(groupMessageRepo).delete(gm);
        verify(groupKeyRepo).deleteByGroupMessageId(any());
        verify(deliveryRepo).deleteByGroupMessageId(any());
    }

    // == Delivery acks ==========================================================

    @Test
    void ackFromTheRealReceiverMarksTheMessageDelivered() {
        User sender = user(9);
        Message m = new Message();
        m.setSender(sender);
        m.setReceiver(user(5));
        m.setStatus("SENT");
        when(messageRepo.findAllById(any())).thenReturn(List.of(m));

        Map<Long, List<Long>> bySender = service.markDelivered(5L, List.of(1L));

        assertNotNull(m.getDeliveredAt());
        assertEquals("DELIVERED", m.getStatus());
        assertTrue(bySender.containsKey(9L), "the sender should be told it was delivered");
    }

    @Test
    void ackFromSomeoneElseIsIgnored() {
        Message m = new Message();
        m.setSender(user(9));
        m.setReceiver(user(5));
        m.setStatus("SENT");
        when(messageRepo.findAllById(any())).thenReturn(List.of(m));

        Map<Long, List<Long>> bySender = service.markDelivered(6L, List.of(1L));

        assertNull(m.getDeliveredAt());
        assertEquals("SENT", m.getStatus());
        assertTrue(bySender.isEmpty());
    }

    @Test
    void anAlreadyDeliveredMessageIsNotAckedTwice() {
        LocalDateTime first = LocalDateTime.now().minusMinutes(1);
        Message m = new Message();
        m.setSender(user(9));
        m.setReceiver(user(5));
        m.setDeliveredAt(first);
        when(messageRepo.findAllById(any())).thenReturn(List.of(m));

        Map<Long, List<Long>> bySender = service.markDelivered(5L, List.of(1L));

        assertEquals(first, m.getDeliveredAt());
        assertTrue(bySender.isEmpty());
    }
}
