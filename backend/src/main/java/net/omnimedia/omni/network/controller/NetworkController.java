package net.omnimedia.omni.network.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.network.dto.NetworkDTO;
import net.omnimedia.omni.network.dto.NetworkMemberDTO;
import net.omnimedia.omni.network.dto.NetworkRoleDTO;
import net.omnimedia.omni.network.service.NetworkService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/networks")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class NetworkController {
    private final NetworkService networkService;

    // Every "who am I" / "act as me" read comes from the auth attribute set
    // by the JWT filter — never from a client-supplied path/body userId.
    // See PostController etc. for the same convention.
    private Long callerId(HttpServletRequest req) {
        return (Long) req.getAttribute("authenticatedUserId");
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long ownerId = callerId(req);
        if (ownerId == null) return ResponseEntity.status(401).build();
        String name = body.get("name").toString();
        String iconUrl = body.containsKey("iconUrl") ? (String) body.get("iconUrl") : null;
        return ResponseEntity.ok(networkService.createNetwork(ownerId, name, iconUrl));
    }

    @GetMapping("/mine")
    public ResponseEntity<?> mine(HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(networkService.getNetworksForUser(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<NetworkDTO> get(@PathVariable Long id) {
        return ResponseEntity.ok(networkService.getNetwork(id));
    }

    @PostMapping("/join")
    public ResponseEntity<?> join(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(networkService.joinByInviteCode(userId, body.get("inviteCode").toString()));
    }

    @DeleteMapping("/{id}/leave")
    public ResponseEntity<?> leave(@PathVariable Long id, HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        networkService.leaveNetwork(id, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<NetworkMemberDTO>> members(@PathVariable Long id) {
        return ResponseEntity.ok(networkService.getMembers(id));
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<?> kick(@PathVariable Long id, @PathVariable Long userId, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        networkService.kickMember(id, requesterId, userId);
        return ResponseEntity.noContent().build();
    }

    // ── Server Profile / Access / Safety Setup ────────────────────────────

    /**
     * PATCH /networks/{id}  body (all optional — only present keys are applied):
     * { name?, description?, privateProfile?, accessMode?, ageRestricted?,
     *   rulesEnabled?, rules?: string[], require2faForModeration?, restrictPruneToAdmins? }
     */
    @PatchMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();

        String name = body.containsKey("name") ? (String) body.get("name") : null;
        String description = body.containsKey("description") ? (String) body.get("description") : null;
        Boolean privateProfile = body.containsKey("privateProfile") ? (Boolean) body.get("privateProfile") : null;
        String accessMode = body.containsKey("accessMode") ? (String) body.get("accessMode") : null;
        Boolean ageRestricted = body.containsKey("ageRestricted") ? (Boolean) body.get("ageRestricted") : null;
        Boolean rulesEnabled = body.containsKey("rulesEnabled") ? (Boolean) body.get("rulesEnabled") : null;
        @SuppressWarnings("unchecked")
        List<String> rules = body.containsKey("rules") ? (List<String>) body.get("rules") : null;
        Boolean require2fa = body.containsKey("require2faForModeration") ? (Boolean) body.get("require2faForModeration") : null;
        Boolean restrictPrune = body.containsKey("restrictPruneToAdmins") ? (Boolean) body.get("restrictPruneToAdmins") : null;

        return ResponseEntity.ok(networkService.updateNetwork(
                id, requesterId, name, description, privateProfile,
                accessMode, ageRestricted, rulesEnabled, rules,
                require2fa, restrictPrune
        ));
    }

    // ── Icon / Banner ──────────────────────────────────────────────────────
    // Multipart, so these are separate endpoints rather than folded into the
    // JSON PATCH above — same split UserController uses for avatar/banner.

    @PostMapping("/{id}/icon")
    public ResponseEntity<?> updateIcon(@PathVariable Long id, @RequestParam("file") MultipartFile file, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(networkService.updateIcon(id, requesterId, file));
    }

    @DeleteMapping("/{id}/icon")
    public ResponseEntity<?> removeIcon(@PathVariable Long id, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(networkService.removeIcon(id, requesterId));
    }

    @PostMapping("/{id}/banner")
    public ResponseEntity<?> updateBanner(@PathVariable Long id, @RequestParam("file") MultipartFile file, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(networkService.updateBanner(id, requesterId, file));
    }

    @DeleteMapping("/{id}/banner")
    public ResponseEntity<?> removeBanner(@PathVariable Long id, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(networkService.removeBanner(id, requesterId));
    }

    // ── Bans ────────────────────────────────────────────────────────────

    @GetMapping("/{id}/bans")
    public ResponseEntity<?> getBans(@PathVariable Long id, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(networkService.getBans(id, requesterId));
    }

    /** POST /networks/{id}/bans  body: { userId, reason? } */
    @PostMapping("/{id}/bans")
    public ResponseEntity<?> ban(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        Long targetUserId = Long.valueOf(body.get("userId").toString());
        String reason = body.containsKey("reason") ? (String) body.get("reason") : null;
        return ResponseEntity.ok(networkService.banMember(id, requesterId, targetUserId, reason));
    }

    @DeleteMapping("/{id}/bans/{userId}")
    public ResponseEntity<?> unban(@PathVariable Long id, @PathVariable Long userId, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        networkService.unbanMember(id, requesterId, userId);
        return ResponseEntity.noContent().build();
    }

    // ── Categories ──────────────────────────────────────────────────────

    @PostMapping("/{id}/categories")
    public ResponseEntity<?> createCategory(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(networkService.createCategory(id, requesterId, body.get("name").toString()));
    }

    @PatchMapping("/{id}/categories/{categoryId}")
    public ResponseEntity<?> renameCategory(@PathVariable Long id, @PathVariable Long categoryId, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(networkService.renameCategory(id, requesterId, categoryId, body.get("name").toString()));
    }

    @DeleteMapping("/{id}/categories/{categoryId}")
    public ResponseEntity<?> deleteCategory(@PathVariable Long id, @PathVariable Long categoryId, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        networkService.deleteCategory(id, requesterId, categoryId);
        return ResponseEntity.noContent().build();
    }

    // ── Roles ───────────────────────────────────────────────────────────

    /** POST /networks/{id}/roles  body: { name, color, permissions, position? } */
    @PostMapping("/{id}/roles")
    public ResponseEntity<?> createRole(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        String name = body.get("name").toString();
        String color = body.containsKey("color") ? (String) body.get("color") : null;
        long permissionMask = body.containsKey("permissions") ? Long.parseLong(body.get("permissions").toString()) : 0L;
        Integer position = body.containsKey("position") ? Integer.valueOf(body.get("position").toString()) : null;
        NetworkRoleDTO role = networkService.createRole(id, requesterId, name, color, permissionMask, position);
        return ResponseEntity.ok(role);
    }

    /** PATCH /networks/{id}/roles/{roleId}  body: { name?, color?, permissions? } */
    @PatchMapping("/{id}/roles/{roleId}")
    public ResponseEntity<?> updateRole(@PathVariable Long id, @PathVariable Long roleId, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        String name = body.containsKey("name") ? (String) body.get("name") : null;
        String color = body.containsKey("color") ? (String) body.get("color") : null;
        Long permissionMask = body.containsKey("permissions") ? Long.parseLong(body.get("permissions").toString()) : null;
        return ResponseEntity.ok(networkService.updateRole(id, requesterId, roleId, name, color, permissionMask));
    }

    @DeleteMapping("/{id}/roles/{roleId}")
    public ResponseEntity<?> deleteRole(@PathVariable Long id, @PathVariable Long roleId, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        networkService.deleteRole(id, requesterId, roleId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/members/{userId}/roles/{roleId}")
    public ResponseEntity<?> assignRole(@PathVariable Long id, @PathVariable Long userId, @PathVariable Long roleId, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        networkService.assignRole(id, requesterId, userId, roleId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/members/{userId}/roles/{roleId}")
    public ResponseEntity<?> removeRole(@PathVariable Long id, @PathVariable Long userId, @PathVariable Long roleId, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        networkService.removeRole(id, requesterId, userId, roleId);
        return ResponseEntity.noContent().build();
    }
}
