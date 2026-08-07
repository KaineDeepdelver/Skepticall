package net.omnimedia.omni.friends.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.friends.service.FriendService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/friends") @RequiredArgsConstructor @CrossOrigin(origins="*")
public class FriendController {
    private final FriendService friendService;

    private Long callerId(HttpServletRequest req) {
        return (Long) req.getAttribute("authenticatedUserId");
    }

    @PostMapping("/request/{targetId}")
    public ResponseEntity<?> send(@PathVariable Long targetId, HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(friendService.sendRequest(userId, targetId));
    }

    @PostMapping("/respond/{requestId}")
    public ResponseEntity<?> respond(@PathVariable Long requestId, @RequestParam String action, HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();

        return ResponseEntity.ok(friendService.respond(requestId, userId, action));
    }

    @DeleteMapping("/{otherId}")
    public ResponseEntity<?> unfriend(@PathVariable Long otherId, HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(friendService.unfriend(userId, otherId));
    }

    // Read-only — viewerId stays a query param, can't mutate state
    @GetMapping("/relationship/{targetId}")
    public ResponseEntity<Map<String,Object>> relationship(@PathVariable Long targetId, @RequestParam Long viewerId) {
        return ResponseEntity.ok(friendService.getRelationship(viewerId, targetId));
    }

    @GetMapping("/pending")
    public ResponseEntity<?> pending(HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(friendService.getPendingRequests(userId));
    }

    @GetMapping("/list")
    public ResponseEntity<?> list(HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(friendService.getFriends(userId));
    }
}
