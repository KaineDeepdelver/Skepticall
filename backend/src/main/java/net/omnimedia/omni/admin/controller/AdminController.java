package net.omnimedia.omni.admin.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.admin.service.AdminService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AdminController {

    private final AdminService adminService;

    // The acting admin's id now comes from the verified JWT (set by JwtFilter),
    // never from a client-supplied query param. SecurityConfig also gates all of
    // /admin/** behind ROLE_ADMIN, so this is defense in depth, not the only check —
    // AdminService.requireAdmin() re-validates against the admins table on every call.
    private Long callerId(HttpServletRequest req) {
        return (Long) req.getAttribute("authenticatedUserId");
    }

    // == Status check ==========================================================

    @GetMapping("/check/{userId}")
    public ResponseEntity<Map<String, Boolean>> checkAdmin(@PathVariable Long userId) {
        return ResponseEntity.ok(Map.of("admin", adminService.isAdmin(userId)));
    }

    // == User roster (for the admin panel) =====================================

    @GetMapping("/users")
    public ResponseEntity<?> listUsers(HttpServletRequest req) {
        return ResponseEntity.ok(adminService.listAllUsers(callerId(req)));
    }

    // == Moderation deletes =====================================================

    @DeleteMapping("/posts/{postId}")
    public ResponseEntity<?> deletePost(@PathVariable Long postId, HttpServletRequest req) {
        adminService.deletePost(callerId(req), postId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<?> deleteComment(@PathVariable Long commentId, HttpServletRequest req) {
        adminService.deleteComment(callerId(req), commentId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/media/{mediaId}")
    public ResponseEntity<?> deleteMedia(@PathVariable Long mediaId, HttpServletRequest req) {
        adminService.deleteMedia(callerId(req), mediaId);
        return ResponseEntity.noContent().build();
    }

    /** Heavy-confirm endpoint — frontend gates this behind the 15s wait + type-CONFIRM modal */
    @DeleteMapping("/users/{userId}")
    public ResponseEntity<?> deleteUser(@PathVariable Long userId, HttpServletRequest req) {
        adminService.deleteUser(callerId(req), userId);
        return ResponseEntity.noContent().build();
    }

    // == Admin roster management ================================================

    @GetMapping("/admins")
    public ResponseEntity<?> listAdmins(HttpServletRequest req) {
        return ResponseEntity.ok(adminService.listAdmins(callerId(req)));
    }

    @PostMapping("/admins/{targetUserId}")
    public ResponseEntity<?> grantAdmin(@PathVariable Long targetUserId, HttpServletRequest req) {
        adminService.grantAdmin(callerId(req), targetUserId);
        return ResponseEntity.ok().build();
    }


    @DeleteMapping("/admins/{targetUserId}")
    public ResponseEntity<?> revokeAdmin(@PathVariable Long targetUserId, HttpServletRequest req) {
            adminService.revokeAdmin(callerId(req), targetUserId);
            return ResponseEntity.noContent().build();

    }
}
