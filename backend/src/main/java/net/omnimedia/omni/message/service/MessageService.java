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

    // == Tempo default TTL in seconds ==
    private static final int TEMPO_TTL_SECONDS = 30;

    // == Queries ==============================================================

    public List<MessageDTO> getConversation(Long user1, Long user2) {
        return messageRepo.findConversation(user1, user2)
                .stream().map(messageMapper::toDTO).collect(Collectors.toList());
    }

    // == Saves ================================================================

    @Transactional
    public MessageDTO saveMessage(MessageDTO dto) {
        dto.setStatus("SENT");

        // == /tempo detection ==
        // If content starts with /tempo (case-insensitive), mark as TEMPO type
        // and strip the command prefix before saving.
        if (dto.getContent() != null) {
            String raw = dto.getContent().trim();
            if (raw.toLowerCase().startsWith("/tempo")) {
                String afterCommand = raw.substring(6).trim(); // strip "/tempo"
                dto.setContent(afterCommand.isEmpty() ? null : afterCommand);
                dto.setType("TEMPO");
                dto.setTempoExpiresAt(LocalDateTime.now().plusSeconds(TEMPO_TTL_SECONDS));
            }
        }

        Message saved = messageRepo.save(messageMapper.toEntity(dto));
        return messageMapper.toDTO(saved);
    }

    // == Edits / Deletes ======================================================

    @Transactional
    public MessageDTO editMessage(Long id, String content, Long requesterId) {
        Message m = messageRepo.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Direct message not found [messageId=" + id + "]"));

        if (!m.getSender().getId().equals(requesterId)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Not your message to edit");
        }

        m.setContent(content);
        m.setEdited(true);
        return messageMapper.toDTO(messageRepo.save(m));
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
        return messageMapper.toDTO(messageRepo.save(m));
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
            m.setTempoExpiresAt(null);
            deleted.add(messageMapper.toDTO(messageRepo.save(m)));
        }
        return deleted;
    }
}
