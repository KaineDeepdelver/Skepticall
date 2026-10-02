package net.omnimedia.omni.group.controller;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.group.dto.GroupMessageDTO;
import net.omnimedia.omni.group.service.GroupService;
import net.omnimedia.omni.group.repository.GroupConversationRepository;
import net.omnimedia.omni.notification.service.PushNotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class GroupWsController {
    private final GroupService groupService;
    private final GroupConversationRepository groupConversationRepository;
    private final PushNotificationService pushService;
    @Autowired private SimpMessagingTemplate messaging;

    private Long uid(Principal principal) {
        if (principal == null) {
            throw new BusinessException(
                    ErrorType.PERMISSION_DENIED,
                    "Unauthenticated WebSocket session access attempted"
            );
        }
        return Long.valueOf(principal.getName());
    }


    @MessageMapping("/group.message")
    public void sendMessage(GroupMessageDTO message, Principal principal) {
        Long groupId  = message.getGroupId();
        Long senderId = uid(principal); // the client can't impersonate another sender by editing the payload
        String content = message.getContent();
        String type    = message.getType() != null ? message.getType() : "TEXT";
        String tmpId   = message.get_tmpId();

        // nonce/replyPreviewNonce/mediaNonce/recipientKeys are all null
        // for a plaintext send (legacy, or a markup/trim send — see
        // GroupService.sendMessage's full-arg overload) — bound straight
        // off the DTO just like everything else here, including the
        // nested recipientKeys list, which Jackson deserializes into
        // List<GroupMessageKeyDTO> automatically.
        GroupMessageDTO saved = groupService.sendMessage(
                groupId, senderId, content, type, null,
                message.getReplyToId(), message.getReplyPreview(), message.getReplyPreviewSender(),
                message.getNonce(), message.getReplyPreviewNonce(), message.getMediaNonce(),
                message.getRecipientKeys());
        if (tmpId != null) saved.set_tmpId(tmpId);

        messaging.convertAndSend("/topic/group/" + groupId, saved);

        var groupInfo = groupService.getGroup(groupId);
        if (groupInfo != null) {
            List<Long> memberIds = groupInfo.getMembers().stream().map(m -> m.getId()).toList();
            // An encrypted message's `content` is ciphertext the server
            // can't read — showing it raw in a push notification would
            // just be base64 gibberish, not a real preview. Same fix as
            // MessageWsController.sendMessage for 1:1.
            boolean encrypted = message.getNonce() != null;
            String preview = encrypted ? "New message"
                    : (content != null && content.length() > 60 ? content.substring(0, 60) + "…" : content);
            if ("TEXT".equalsIgnoreCase(type)) {
                pushService.notifyGroupMessage(senderId, groupId, groupInfo.getName(), memberIds, preview);
            } else {
                pushService.notifyGroupAttachment(senderId, groupId, groupInfo.getName(), memberIds, type);
            }
        }
    }

    @MessageMapping("/group.message.edit")
    public void editMessage(GroupMessageDTO message, Principal principal) {
        Long messageId   = message.getId();
        Long requesterId = uid(principal);
        Long groupId     = message.getGroupId();

        GroupMessageDTO edited = groupService.editMessage(
                messageId, requesterId, message.getContent(), message.getNonce(), message.getRecipientKeys());
        // Wire-protocol marker only (not persisted) — mirrors
        // MessageWsController.editMessage(), which the client's
        // `msg._type || msg.type` dispatch in handleWsMessage expects, or
        // an edit broadcast gets misread as a brand-new message instead of
        // an update to an existing one.
        edited.setType("EDIT");
        messaging.convertAndSend("/topic/group/" + groupId, edited);
    }

    @MessageMapping("/group.message.delete")
    public void deleteMessage(Map<String, Object> payload, Principal principal) {
        Long messageId   = Long.valueOf(payload.get("messageId").toString());
        Long requesterId = uid(principal); // was previously read from payload.get("senderId")
        Long groupId     = Long.valueOf(payload.get("groupId").toString());

        GroupMessageDTO deleted = groupService.deleteGroupMessage(messageId, requesterId);
        messaging.convertAndSend("/topic/group/" + groupId, deleted);
    }
}
