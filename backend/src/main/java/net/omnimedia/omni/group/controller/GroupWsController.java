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
    public void sendMessage(Map<String, Object> payload, Principal principal) {
        Long groupId  = Long.valueOf(payload.get("groupId").toString());
        Long senderId = uid(principal); // was previously read from payload.get("senderId")
        String content = payload.containsKey("content") ? payload.get("content").toString() : null;
        String type    = payload.containsKey("type")    ? payload.get("type").toString()    : "TEXT";
        String tmpId   = payload.containsKey("_tmpId")  ? payload.get("_tmpId").toString()  : null;
        Long replyToId = payload.containsKey("replyToId") ? Long.valueOf(payload.get("replyToId").toString()) : null;
        String replyPreview = payload.containsKey("replyPreview") ? payload.get("replyPreview").toString() : null;
        String replyPreviewSender = payload.containsKey("replyPreviewSender") ? payload.get("replyPreviewSender").toString() : null;

        GroupMessageDTO saved = groupService.sendMessage(groupId, senderId, content, type, null, replyToId, replyPreview, replyPreviewSender);
        if (tmpId != null) saved.set_tmpId(tmpId);

        messaging.convertAndSend("/topic/group/" + groupId, saved);

        var groupInfo = groupService.getGroup(groupId);
        if (groupInfo != null) {
            List<Long> memberIds = groupInfo.getMembers().stream().map(m -> m.getId()).toList();
            String preview = content != null && content.length() > 60 ? content.substring(0, 60) + "…" : content;
            if ("TEXT".equalsIgnoreCase(type)) {
                pushService.notifyGroupMessage(senderId, groupId, groupInfo.getName(), memberIds, preview);
            } else {
                pushService.notifyGroupAttachment(senderId, groupId, groupInfo.getName(), memberIds, type);
            }
        }
    }

    @MessageMapping("/group.message.edit")
    public void editMessage(Map<String, Object> payload, Principal principal) {
        Long messageId   = Long.valueOf(payload.get("messageId").toString());
        Long requesterId = uid(principal);
        Long groupId     = Long.valueOf(payload.get("groupId").toString());
        String content   = payload.containsKey("content") ? payload.get("content").toString() : null;

        GroupMessageDTO edited = groupService.editMessage(messageId, requesterId, content);
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
