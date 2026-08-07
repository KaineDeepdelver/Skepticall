package net.omnimedia.omni.message.controller;

import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.message.dto.MessageDTO;
import net.omnimedia.omni.message.service.MessageService;
import net.omnimedia.omni.notification.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.List;

@Controller
public class MessageWsController {

    @Autowired private SimpMessagingTemplate messagingTemplate;
    @Autowired private MessageService messageService;
    @Autowired private NotificationService notifService;

    private Long uid(Principal principal) {
        if (principal == null) {
            throw new BusinessException(
                    ErrorType.PERMISSION_DENIED,
                    "Unauthenticated WebSocket session access attempted"
            );
        }
        return Long.valueOf(principal.getName());
    }


    @MessageMapping("/message.send")
    public void sendMessage(MessageDTO message, Principal principal) {
        // senderId is whoever the STOMP session authenticated as — the client
        // can no longer impersonate another sender by editing the payload.
        message.setSenderId(uid(principal));

        // Capture the correlation token before saving (it's not persisted).
        String tmpId = message.get_tmpId();

        MessageDTO saved = messageService.saveMessage(message);

        // Echo the token back so the frontend can replace its optimistic placeholder.
        saved.set_tmpId(tmpId);

        broadcast(saved);

        if (saved.getReceiverId() != null && saved.getSenderId() != null) {
            String type = saved.getType() != null ? saved.getType() : "TEXT";
            switch (type) {
                case "VOICE" -> notifService.notifyVoiceMessage(
                        saved.getSenderId(), saved.getReceiverId(), saved.getId());
                case "TEMPO" -> notifService.notifyMessage(
                        saved.getSenderId(), saved.getReceiverId(), saved.getId(), "💨 Self-destruct message");
                default -> {
                    if (saved.getReplyToId() != null) {
                        String preview = saved.getContent() != null
                            ? saved.getContent().length() > 60
                                ? saved.getContent().substring(0, 60) + "…"
                                : saved.getContent()
                            : null;
                        notifService.notifyReply(
                            saved.getSenderId(), saved.getReceiverId(), saved.getId(), preview);
                    } else {
                        String preview = saved.getContent() != null
                            ? saved.getContent().length() > 60
                                ? saved.getContent().substring(0, 60) + "…"
                                : saved.getContent()
                            : null;
                        notifService.notifyMessage(
                            saved.getSenderId(), saved.getReceiverId(), saved.getId(), preview);
                    }
                }
            }
        }
    }

    @MessageMapping("/message.edit")
    public void editMessage(MessageDTO message, Principal principal) {
        MessageDTO updated = messageService.editMessage(message.getId(), message.getContent(), uid(principal));
        updated.setType("EDIT");
        broadcast(updated);
    }

    @MessageMapping("/message.delete")
    public void deleteMessage(MessageDTO message, Principal principal) {
        MessageDTO deleted = messageService.deleteMessage(message.getId(), uid(principal));
        deleted.setType("DELETE");
        broadcast(deleted);
    }

    @MessageMapping("/message.read")
    public void markRead(MessageDTO message, Principal principal) {
        // Read receipts: the authenticated user is always the "toUserId" (the
        // reader). fromUserId still comes from the payload since it identifies
        // whose messages are being marked read, not who's performing the action.
        Long toUserId   = uid(principal);
        Long fromUserId = message.getSenderId();

        List<MessageDTO> updated = messageService.markMessagesRead(fromUserId, toUserId);

        MessageDTO receipt = new MessageDTO();
        receipt.setType("READ_RECEIPT");
        receipt.setSenderId(fromUserId);
        receipt.setReceiverId(toUserId);

        messagingTemplate.convertAndSend("/topic/messages/" + fromUserId, receipt);
        messagingTemplate.convertAndSend("/topic/messages/" + toUserId,   receipt);
    }

    // == Tempo expiry scheduler — runs every 10 seconds, unrelated to auth ===

    @Scheduled(fixedDelay = 10_000)
    public void purgeExpiredTempoMessages() {
        List<MessageDTO> expired = messageService.expireTempoMessages();
        for (MessageDTO msg : expired) {
            msg.setType("DELETE");
            broadcast(msg);
        }
    }

    // == Internal =============================================================

    private void broadcast(MessageDTO msg) {
        messagingTemplate.convertAndSend("/topic/messages/" + msg.getReceiverId(), msg);
        messagingTemplate.convertAndSend("/topic/messages/" + msg.getSenderId(),   msg);
    }
}
