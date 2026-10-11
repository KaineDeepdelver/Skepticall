package com.skepticall.app.notification.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import com.skepticall.app.notification.dto.NotificationDTO;
import com.skepticall.app.notification.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class NotificationController {

    private final NotificationService notifService;

    private Long callerId(HttpServletRequest req) {
        return (Long) req.getAttribute("authenticatedUserId");
    }

    @GetMapping
    public ResponseEntity<?> getAll(HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(notifService.getForUser(userId));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> unreadCount(HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(Map.of("count", notifService.getUnreadCount(userId)));
    }

    @PostMapping("/mark-read")
    public ResponseEntity<Void> markRead(HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        notifService.markAllRead(userId);
        return ResponseEntity.ok().build();
    }
}
