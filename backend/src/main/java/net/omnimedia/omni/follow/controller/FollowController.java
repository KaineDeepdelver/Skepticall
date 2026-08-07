package net.omnimedia.omni.follow.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.follow.service.FollowService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController @RequestMapping("/follow") @RequiredArgsConstructor @CrossOrigin(origins="*")
public class FollowController {
    private final FollowService followService;

    private Long callerId(HttpServletRequest req) {
        return (Long) req.getAttribute("authenticatedUserId");
    }

    @PostMapping("/{targetId}/toggle")
    public ResponseEntity<?> toggle(@PathVariable Long targetId, HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(followService.toggle(userId, targetId));
    }

    // Read-only — viewerId only affects which "isFollowing" flag comes back,
    // it can't mutate anything, so it's safe to leave as a query param.
    @GetMapping("/{targetId}/status")
    public ResponseEntity<Map<String,Object>> status(@PathVariable Long targetId, @RequestParam Long viewerId) {
        return ResponseEntity.ok(followService.status(viewerId, targetId));
    }
}
