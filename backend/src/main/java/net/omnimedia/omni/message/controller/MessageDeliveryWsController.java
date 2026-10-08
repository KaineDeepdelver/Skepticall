package net.omnimedia.omni.message.controller;

import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.message.service.MessageRetentionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Delivery acknowledgements from the apps: "I stored these messages on my device".
 *   /app/message.delivered        {ids: [...]}                 direct messages
 *   /app/group.message.delivered  {groupId, ids: [...]}        group messages
 * Senders are told on their own /topic/delivery/{id} channel (not the shared message topic,
 * so clients that don't know about it never see it).
 */
@Controller
public class MessageDeliveryWsController {

    @Autowired private MessageRetentionService retention;
    @Autowired private SimpMessagingTemplate messaging;

    private Long uid(Principal principal) {
        if (principal == null) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Unauthenticated WebSocket session access attempted");
        }
        return Long.valueOf(principal.getName());
    }

    private List<Long> ids(Object raw) {
        List<Long> out = new ArrayList<>();
        if (raw instanceof List) {
            for (Object o : (List<?>) raw) {
                try { out.add(Long.valueOf(o.toString())); } catch (Exception ignored) { /* skip bad id */ }
            }
        }
        return out;
    }

    @MessageMapping("/message.delivered")
    public void delivered(Map<String, Object> payload, Principal principal) {
        Long me = uid(principal);
        Map<Long, List<Long>> bySender = retention.markDelivered(me, ids(payload.get("ids")));
        for (Map.Entry<Long, List<Long>> e : bySender.entrySet()) {
            Map<String, Object> out = new HashMap<>();
            out.put("ids", e.getValue());
            out.put("receiverId", me);
            messaging.convertAndSend("/topic/delivery/" + e.getKey(), (Object) out);
        }
    }

    @MessageMapping("/group.message.delivered")
    public void groupDelivered(Map<String, Object> payload, Principal principal) {
        Long me = uid(principal);
        Object g = payload.get("groupId");
        if (g == null) return;
        retention.markGroupDelivered(me, Long.valueOf(g.toString()), ids(payload.get("ids")));
    }
}
