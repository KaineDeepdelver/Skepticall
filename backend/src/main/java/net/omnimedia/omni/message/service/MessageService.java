package net.omnimedia.omni.message.service;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.message.dto.ConversationDTO;
import net.omnimedia.omni.message.dto.MessageDTO;
import net.omnimedia.omni.message.entity.Message;
import net.omnimedia.omni.message.mapper.MessageMapper;
import net.omnimedia.omni.message.repository.MessageRepository;
import net.omnimedia.omni.user.entity.User;
import net.omnimedia.omni.user.repository.UserRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepo;
    private final UserRepository userRepo;
    private final MessageMapper messageMapper;
    private final MessageRetentionService retentionService;

    // == Tempo default TTL in seconds ==
    private static final int TEMPO_TTL_SECONDS = 30;

    // == Queries ==============================================================

    public List<MessageDTO> getConversation(Long user1, Long user2) {
        return messageRepo.findConversation(user1, user2)
                .stream().map(messageMapper::toDTO).collect(Collectors.toList());
    }

    /** Powers the Call Log tab — every call this user's been part of, most recent first, across every DM. */
    public List<MessageDTO> getCallLog(Long userId) {
        return messageRepo.findCallsForUser(userId)
                .stream().map(messageMapper::toDTO).collect(Collectors.toList());
    }

    // == Saves ================================================================

    @Transactional
    public MessageDTO saveMessage(MessageDTO dto) {
        // Covers both the WebSocket and REST send paths: a DM to yourself makes no sense.
        if (dto.getReceiverId() != null && dto.getReceiverId().equals(dto.getSenderId())) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "You can't send a message to yourself");
        }
        dto.setStatus("SENT");

        // == /tempo detection ==
        // Used to detect a "/tempo " prefix by reading dto.getContent()
        // directly — that only worked because content was always plaintext
        // server-side. Now that content can be E2E-encrypted, the server
        // can't read it at all, so this has to be the client's decision:
        // the client strips the "/tempo " prefix itself before encrypting
        // and declares intent by sending type "TEMPO" directly. The server
        // still owns the actual TTL (not trusting a client-supplied expiry
        // time), it just no longer inspects content to detect the command.
        if ("TEMPO".equals(dto.getType())) {
            dto.setTempoExpiresAt(LocalDateTime.now().plusSeconds(TEMPO_TTL_SECONDS));
        }

        Message saved = messageRepo.save(messageMapper.toEntity(dto));
        MessageDTO out = messageMapper.toDTO(saved);
        retentionService.cacheNew(out);
        return out;
    }

    // == Edits / Deletes ======================================================

    @Transactional
    public MessageDTO editMessage(Long id, String content, String nonce, Long requesterId) {
        Message m = messageRepo.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Direct message not found [messageId=" + id + "]"));

        if (!m.getSender().getId().equals(requesterId)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Not your message to edit");
        }

        m.setContent(content);
        // A new ciphertext needs a fresh nonce every time (reusing a nonce
        // with the same key pair breaks crypto_box's security guarantees),
        // so this always has to be replaced together with content, never
        // left stale from the original message — a mismatched nonce would
        // just make the edited message permanently undecryptable.
        m.setNonce(nonce);
        m.setEdited(true);
        MessageDTO out = messageMapper.toDTO(messageRepo.save(m));
        retentionService.refreshCached(out);
        return out;
    }


    @Transactional
    public MessageDTO deleteMessage(Long id, Long requesterId) {
        Message m = messageRepo.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Direct message not found [messageId=" + id + "]"));

        if (!m.getSender().getId().equals(requesterId)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Not your message to delete");
        }

        m.setType("DELETE");
        m.setContent(null);
        m.setFileUrl(null);
        m.setNonce(null);
        m.setMediaNonce(null);
        m.setMediaKeyCiphertext(null);
        m.setMediaKeyNonce(null);
        MessageDTO out = messageMapper.toDTO(messageRepo.save(m));
        retentionService.refreshCached(out);
        return out;
    }


    // == Read receipts ========================================================

    @Transactional
    public List<MessageDTO> markMessagesRead(Long fromUserId, Long toUserId) {
        List<Message> unread = messageRepo.findUnreadMessages(fromUserId, toUserId);
        unread.forEach(m -> m.setStatus("READ"));
        messageRepo.saveAll(unread);
        return unread.stream().map(messageMapper::toDTO).collect(Collectors.toList());
    }

    // == Conversations ========================================================

    public List<ConversationDTO> getUserConversations(Long userId) {
        List<Message> recent = messageRepo.findRecentConversations(userId);
        Map<Long, ConversationDTO> map = new LinkedHashMap<>();

        for (Message m : recent) {
            User other = m.getSender().getId().equals(userId) ? m.getReceiver() : m.getSender();
            Long otherId = other.getId();
            if (map.containsKey(otherId)) continue;

            String preview;
            if ("DELETE".equals(m.getType()))       preview = "Message deleted";
            else if ("TEMPO".equals(m.getType()))   preview = "💨 Self-destruct message";
            else if (m.getContent() != null)        preview = m.getContent();
            else if ("VOICE".equals(m.getType()))   preview = "🎤 Voice message";
            else if ("IMAGE".equals(m.getType()))   preview = "🖼 Image";
            else if ("VIDEO".equals(m.getType()))   preview = "🎬 Video";
            else if ("GIF".equals(m.getType()))     preview = "GIF";
            else                                    preview = "📎 Attachment";

            long unread = messageRepo.countUnreadMessages(otherId, userId);

            ConversationDTO dto = new ConversationDTO();
            dto.setUserId(otherId);
            dto.setName(other.getDisplayName() != null ? other.getDisplayName() : other.getUsername());
            dto.setUsername(other.getUsername());
            dto.setAvatar(other.getProfilePicture());
            dto.setLastMsg(preview);
            dto.setLastTime(m.getCreatedAt());
            dto.setUnread((int) unread);
            map.put(otherId, dto);
        }
        return new ArrayList<>(map.values());
    }

    // == Tempo expiry — runs every 10 seconds ================================

    /**
     * Finds all TEMPO messages whose expiry has passed and soft-deletes them.
     * Returns the deleted DTOs so the WS controller can broadcast removals.
     */
    @Transactional
    public List<MessageDTO> expireTempoMessages() {
        List<Message> expired = messageRepo.findExpiredTempoMessages(LocalDateTime.now());
        List<MessageDTO> deleted = new ArrayList<>();
        for (Message m : expired) {
            m.setType("DELETE");
            m.setContent(null);
            m.setNonce(null);
            m.setTempoExpiresAt(null);
            deleted.add(messageMapper.toDTO(messageRepo.save(m)));
        }
        return deleted;
    }
}
