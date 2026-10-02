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
        entity.setNonce(dto.getNonce());
        entity.setReplyPreviewNonce(dto.getReplyPreviewNonce());
        entity.setMediaNonce(dto.getMediaNonce());
        entity.setMediaKeyCiphertext(dto.getMediaKeyCiphertext());
        entity.setMediaKeyNonce(dto.getMediaKeyNonce());
        entity.setCallMode(dto.getCallMode());
        entity.setCallStatus(dto.getCallStatus());
        entity.setRingSeconds(dto.getRingSeconds());
        entity.setCallDurationSeconds(dto.getCallDurationSeconds());
        entity.setEdited(dto.getEdited() != null ? dto.getEdited() : false);
        entity.setReplyToId(dto.getReplyToId());
        entity.setReplyPreview(dto.getReplyPreview());
        entity.setReplyPreviewSender(dto.getReplyPreviewSender());
        entity.setStatus(dto.getStatus() != null ? dto.getStatus() : "SENT");
        entity.setDurationSeconds(dto.getDurationSeconds());
        entity.setWaveformPeaks(dto.getWaveformPeaks());
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
        dto.setNonce(entity.getNonce());
        dto.setReplyPreviewNonce(entity.getReplyPreviewNonce());
        dto.setMediaNonce(entity.getMediaNonce());
        dto.setMediaKeyCiphertext(entity.getMediaKeyCiphertext());
        dto.setMediaKeyNonce(entity.getMediaKeyNonce());
        dto.setCallMode(entity.getCallMode());
        dto.setCallStatus(entity.getCallStatus());
        dto.setRingSeconds(entity.getRingSeconds());
        dto.setCallDurationSeconds(entity.getCallDurationSeconds());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setEdited(entity.getEdited());
        dto.setReplyToId(entity.getReplyToId());
        dto.setReplyPreview(entity.getReplyPreview());
        dto.setReplyPreviewSender(entity.getReplyPreviewSender());
        dto.setStatus(entity.getStatus() != null ? entity.getStatus() : "SENT");
        dto.setDurationSeconds(entity.getDurationSeconds());
        dto.setWaveformPeaks(entity.getWaveformPeaks());
        dto.setTempoExpiresAt(entity.getTempoExpiresAt());

        return dto;
    }
}
