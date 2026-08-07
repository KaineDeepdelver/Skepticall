package net.omnimedia.omni.group.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.group.dto.*;
import net.omnimedia.omni.group.service.GroupService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/groups")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class GroupController {
    private final GroupService groupService;

    private Long callerId(HttpServletRequest req) {
        return (Long) req.getAttribute("authenticatedUserId");
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long creatorId = callerId(req);
        if (creatorId == null) return ResponseEntity.status(401).build();
        String name = body.get("name").toString();
        @SuppressWarnings("unchecked")
        List<Integer> raw = (List<Integer>) body.get("memberIds");
        List<Long> memberIds = raw.stream().map(i -> (long)(int)i).toList();
        return ResponseEntity.ok(groupService.createGroup(creatorId, name, memberIds));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<GroupDTO>> getForUser(@PathVariable Long userId) {
        return ResponseEntity.ok(groupService.getGroupsForUser(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<GroupDTO> get(@PathVariable Long id) {
        return ResponseEntity.ok(groupService.getGroup(id));
    }

    @GetMapping("/{id}/messages")
    public ResponseEntity<List<GroupMessageDTO>> getMessages(@PathVariable Long id) {
        return ResponseEntity.ok(groupService.getMessages(id));
    }

    @PostMapping("/{id}/messages")
    public ResponseEntity<?> sendMessage(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long senderId = callerId(req);
        if (senderId == null) return ResponseEntity.status(401).build();
        String content = body.containsKey("content") ? body.get("content").toString() : null;
        String type    = body.containsKey("type")    ? body.get("type").toString()    : "TEXT";
        String fileUrl = body.containsKey("fileUrl") ? body.get("fileUrl").toString() : null;

            return ResponseEntity.ok(groupService.sendMessage(id, senderId, content, type, fileUrl));
    }

    /** PATCH /groups/{id}/rename  body: { name } */
    @PatchMapping("/{id}/rename")
    public ResponseEntity<?> rename(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
            return ResponseEntity.ok(groupService.renameGroup(id, requesterId, body.get("name").toString()));
    }

    /** POST /groups/{id}/members  body: { memberIds: [..] } */
    @PostMapping("/{id}/members")
    public ResponseEntity<?> addMembers(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        @SuppressWarnings("unchecked")
        List<Integer> raw = (List<Integer>) body.get("memberIds");
        List<Long> memberIds = raw.stream().map(i -> (long)(int)i).toList();
            return ResponseEntity.ok(groupService.addMembers(id, requesterId, memberIds));
    }

    @DeleteMapping("/{id}/members/{memberId}")
    public ResponseEntity<?> removeMember(@PathVariable Long id, @PathVariable Long memberId, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
            return ResponseEntity.ok(groupService.removeMember(id, requesterId, memberId));
    }

    @DeleteMapping("/{id}/leave")
    public ResponseEntity<?> leave(@PathVariable Long id, HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        groupService.leaveGroup(id, userId);
        return ResponseEntity.noContent().build();
    }

    /** PATCH /groups/{id}/permissions  body: { permEditSettings, permSendMessages, permAddMembers } */
    @PatchMapping("/{id}/permissions")
    public ResponseEntity<?> updatePermissions(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        Boolean permEditSettings = body.containsKey("permEditSettings") ? (Boolean) body.get("permEditSettings") : null;
        Boolean permSendMessages = body.containsKey("permSendMessages") ? (Boolean) body.get("permSendMessages") : null;
        Boolean permAddMembers   = body.containsKey("permAddMembers")   ? (Boolean) body.get("permAddMembers")   : null;
            return ResponseEntity.ok(groupService.updatePermissions(id, requesterId, permEditSettings, permSendMessages, permAddMembers));
    }
}
