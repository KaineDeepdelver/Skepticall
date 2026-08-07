package net.omnimedia.omni.group.controller;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.group.dto.GroupMessageDTO;
import net.omnimedia.omni.group.service.GroupService;
import net.omnimedia.omni.group.repository.GroupConversationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class GroupWsController {
    private final GroupService groupService;
    private final GroupConversationRepository groupConversationRepository;
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

        GroupMessageDTO saved = groupService.sendMessage(groupId, senderId, content, type, null);
        if (tmpId != null) saved.set_tmpId(tmpId);

        messaging.convertAndSend("/topic/group/" + groupId, saved);
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
