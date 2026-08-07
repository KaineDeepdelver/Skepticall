package net.omnimedia.omni.message.mapper;

import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.message.dto.MessageDTO;
import net.omnimedia.omni.message.entity.Message;
import net.omnimedia.omni.user.entity.User;
import net.omnimedia.omni.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class MessageMapper {

    @Autowired
    private UserRepository userRepository;

    public Message toEntity(MessageDTO dto) {
        Message entity = new Message();

        User sender = userRepository.findById(dto.getSenderId())
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Sender user profile not found [senderId=" + dto.getSenderId() + "]"));

        User receiver = userRepository.findById(dto.getReceiverId())
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Receiver user profile not found [receiverId=" + dto.getReceiverId() + "]"));

        entity.setSender(sender);
        entity.setReceiver(receiver);
        entity.setContent(dto.getContent());
        entity.setType(dto.getType());
        entity.setFileUrl(dto.getFileUrl());
        entity.setEdited(dto.getEdited() != null ? dto.getEdited() : false);
        entity.setReplyToId(dto.getReplyToId());
        entity.setReplyPreview(dto.getReplyPreview());
        entity.setStatus(dto.getStatus() != null ? dto.getStatus() : "SENT");
        entity.setDurationSeconds(dto.getDurationSeconds());
        entity.setTempoExpiresAt(dto.getTempoExpiresAt());

        return entity;
    }

    public MessageDTO toDTO(Message entity) {
        MessageDTO dto = new MessageDTO();

        dto.setId(entity.getId());
        dto.setSenderId(entity.getSender().getId());
        dto.setReceiverId(entity.getReceiver().getId());
        dto.setContent(entity.getContent());
        dto.setType(entity.getType());
        dto.setFileUrl(entity.getFileUrl());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setEdited(entity.getEdited());
        dto.setReplyToId(entity.getReplyToId());
        dto.setReplyPreview(entity.getReplyPreview());
        dto.setStatus(entity.getStatus() != null ? entity.getStatus() : "SENT");
        dto.setDurationSeconds(entity.getDurationSeconds());
        dto.setTempoExpiresAt(entity.getTempoExpiresAt());

        return dto;
    }
}
