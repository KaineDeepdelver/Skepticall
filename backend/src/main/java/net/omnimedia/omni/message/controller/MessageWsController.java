package net.omnimedia.omni.message.controller;

import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.message.dto.MessageDTO;
import net.omnimedia.omni.message.service.MessageService;
import net.omnimedia.omni.notification.service.NotificationService;
import net.omnimedia.omni.notification.service.PushNotificationService;
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
    @Autowired private PushNotificationService pushService;

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
                case "VOICE" -> {
                    notifService.notifyVoiceMessage(
                        saved.getSenderId(), saved.getReceiverId(), saved.getId());
                    pushService.notifyVoiceMessage(saved.getSenderId(), saved.getReceiverId());
                }
                case "TEMPO" -> {
                    notifService.notifyMessage(
                        saved.getSenderId(), saved.getReceiverId(), saved.getId(), "💨 Self-destruct message");
                    pushService.notifyMessage(saved.getSenderId(), saved.getReceiverId(), "💨 Self-destruct message");
                }
                default -> {
                    String preview = saved.getContent() != null
                        ? saved.getContent().length() > 60
                            ? saved.getContent().substring(0, 60) + "…"
                            : saved.getContent()
                        : null;
                    if (saved.getReplyToId() != null) {
                        notifService.notifyReply(
                            saved.getSenderId(), saved.getReceiverId(), saved.getId(), preview);
                    } else {
                        notifService.notifyMessage(
                            saved.getSenderId(), saved.getReceiverId(), saved.getId(), preview);
                    }
                    pushService.notifyMessage(saved.getSenderId(), saved.getReceiverId(), preview);
                }
            }
        }
    }

    @MessageMapping("/message.edit")
    public void editMessage(MessageDTO message, Principal principal) {
        MessageDTO updated = messageService.editMessage(message.getId(), message.getContent(), message.getNonce(), uid(principal));
        updated.setType("EDIT");
        broadcast(updated);
    }

    @MessageMapping("/message.delete")
    public void deleteMessage(MessageDTO message, Principal principal) {
        MessageDTO deleted = messageService.deleteMessage(message.getId(), uid(principal));
        deleted.setType("DELETE");
        broadcast(deleted);
    }

    @Autowired private net.omnimedia.omni.group.service.GroupService groupService;
    private static final org.slf4j.Logger TYPING_LOG = org.slf4j.LoggerFactory.getLogger(MessageWsController.class);

    /**
     * "X is typing". Relayed on each recipient's own /topic/typing/{id} channel (not the shared
     * message topic) so web and older clients, which don't know about it, never see it.
     * DM:    {receiverId, typing}
     * Group: {groupId, typing}  — fanned out to every other member; sender must be a member.
     */
    @MessageMapping("/typing")
    public void typing(java.util.Map<String, Object> payload, Principal principal) {
        Long from = uid(principal);
        boolean typing = Boolean.TRUE.equals(payload.get("typing"));
        TYPING_LOG.info("[typing] from={} payload={}", from, payload);
        try {
            Object groupObj = payload.get("groupId");
            Object toObj = payload.get("receiverId");
            if (groupObj != null) {
                Long groupId = Long.valueOf(groupObj.toString());
                net.omnimedia.omni.group.dto.GroupDTO g = groupService.getGroup(groupId);
                boolean isMember = g.getMembers().stream().anyMatch(m -> from.equals(m.getId()));
                if (!isMember) return;
                for (net.omnimedia.omni.group.dto.MemberDTO m : g.getMembers()) {
                    if (from.equals(m.getId())) continue;
                    java.util.Map<String, Object> out = new java.util.HashMap<>();
                    out.put("senderId", from);
                    out.put("groupId", groupId);
                    out.put("typing", typing);
                    messagingTemplate.convertAndSend("/topic/typing/" + m.getId(), (Object) out);
                }
            } else if (toObj != null) {
                Long to = Long.valueOf(toObj.toString());
                if (to.equals(from)) return;
                java.util.Map<String, Object> out = new java.util.HashMap<>();
                out.put("senderId", from);
                out.put("typing", typing);
                messagingTemplate.convertAndSend("/topic/typing/" + to, (Object) out);
            }
        } catch (Exception e) {
            // typing hints are best-effort, but say why one was dropped
            TYPING_LOG.warn("[typing] relay failed from={} payload={}: {}", from, payload, e.toString());
        }
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
