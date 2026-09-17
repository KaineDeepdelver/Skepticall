package net.omnimedia.omni.user.controller;

import net.omnimedia.omni.user.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;

@Controller
public class PresenceWsController {

    @Autowired private SimpMessagingTemplate messaging;
    @Autowired private UserService userService;

    @MessageMapping("/presence")
    public void handlePresence(Map<String, Object> payload, Principal principal) {
        if (principal == null) return; // unauthenticated session — ignore silently

        Long userId = Long.valueOf(principal.getName());
        boolean online = Boolean.TRUE.equals(payload.get("online"));

        userService.setOnline(userId, online);

        Map<String, Object> broadcast = new HashMap<>();
        broadcast.put("userId", userId);
        broadcast.put("online", online);

        messaging.convertAndSend((String) "/topic/presence", (Object) broadcast);
    }
}
