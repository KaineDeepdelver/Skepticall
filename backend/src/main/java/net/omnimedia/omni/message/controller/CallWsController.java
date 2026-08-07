package net.omnimedia.omni.message.controller;

import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.notification.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;

@Controller
public class CallWsController {

    @Autowired private SimpMessagingTemplate messaging;
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


    // senderId is overwritten with the authenticated id before relaying, so a
    // caller can no longer spoof who a CALL_OFFER/ANSWER/ICE frame appears to be from.
    private void relay(String wsType, Map<String, Object> payload, Principal principal) {
        Object targetId = payload.get("targetId");
        if (targetId == null) return;
        Map<String, Object> out = new HashMap<>(payload);
        out.put("senderId", uid(principal));
        out.put("_type", wsType);
        messaging.convertAndSend("/topic/messages/" + targetId.toString(), (Object) out);
    }

    @MessageMapping("/call.offer")
    public void offer(Map<String, Object> payload, Principal principal) {
        Long from = uid(principal);
        relay("CALL_OFFER", payload, principal);

        Object targetId  = payload.get("targetId");
        String callType  = (String) payload.getOrDefault("type", "audio");
        if (targetId != null) {
            Long to = Long.valueOf(targetId.toString());
            if ("video".equals(callType)) notifService.notifyVideoCall(from, to);
            else                          notifService.notifyCall(from, to);
        }
    }

    @MessageMapping("/call.answer")
    public void answer(Map<String, Object> payload, Principal principal) {
        relay("CALL_ANSWER", payload, principal);
    }

    @MessageMapping("/call.ice")
    public void ice(Map<String, Object> payload, Principal principal) {
        relay("CALL_ICE", payload, principal);
    }

    @MessageMapping("/call.decline")
    public void decline(Map<String, Object> payload, Principal principal) {
        relay("CALL_DECLINE", payload, principal);
    }

    @MessageMapping("/call.end")
    public void end(Map<String, Object> payload, Principal principal) {
        relay("CALL_END", payload, principal);
    }
}
