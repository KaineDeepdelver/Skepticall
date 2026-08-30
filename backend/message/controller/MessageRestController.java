package net.omnimedia.omni.message.controller;

import jakarta.servlet.http.HttpServletRequest;
import net.omnimedia.omni.config.R2StorageService;
import net.omnimedia.omni.group.dto.GroupMessageDTO;
import net.omnimedia.omni.group.service.GroupService;
import net.omnimedia.omni.message.dto.ConversationDTO;
import net.omnimedia.omni.message.dto.MessageDTO;
import net.omnimedia.omni.message.service.MessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.nio.file.*;
import java.util.*;

@RestController
@RequestMapping("/messages")
@CrossOrigin(origins = "*")
public class MessageRestController {

    @Autowired private MessageService messageService;
    @Autowired private SimpMessagingTemplate messagingTemplate;
    @Autowired private GroupService groupService;
    @Autowired private R2StorageService r2Storage;
    @Autowired private net.omnimedia.omni.media.util.VideoTrimService videoTrimService;
    @Autowired private net.omnimedia.omni.media.util.ImageMarkupService imageMarkupService;

    private Long callerId(HttpServletRequest req) {
        return (Long) req.getAttribute("authenticatedUserId");
    }

    @GetMapping("/{user1}/{user2}")
    public List<MessageDTO> getConversation(@PathVariable Long user1, @PathVariable Long user2) {
        return messageService.getConversation(user1, user2);
    }

    /** Edit only your own message — was previously unauthenticated, now enforced via JWT */
    @PutMapping("/{id}")
    public ResponseEntity<?> editMessage(@PathVariable Long id,
                                          @RequestBody Map<String, String> body,
                                          HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
            return ResponseEntity.ok(messageService.editMessage(id, body.get("content"), requesterId));
    }

    /** Delete only your own message — was previously unauthenticated, now enforced via JWT */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteMessage(@PathVariable Long id, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
            messageService.deleteMessage(id, requesterId);
            return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/{userId}/conversations")
    public ResponseEntity<?> getUserConversations(@PathVariable Long userId, HttpServletRequest req) {
        Long caller = callerId(req);
        if (caller == null || !caller.equals(userId)) return ResponseEntity.status(403).build();
        return ResponseEntity.ok(messageService.getUserConversations(userId));
    }

    /**
     * Upload endpoint for voice messages, images, videos, files sent in chat.
     * Works for both DMs (receiverId) and group chats (groupId).
     * senderId is derived from the JWT — never trusted from the request.
     */
    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    public ResponseEntity<?> uploadMessage(
            @RequestParam(required = false) Long receiverId,
            @RequestParam(required = false) Long groupId,
            @RequestParam String type,
            @RequestParam MultipartFile file,
            @RequestParam(required = false) String content,
            @RequestParam(required = false) String replyToId,
            @RequestParam(required = false) String replyPreview,
            @RequestParam(required = false) Integer durationSeconds,
            @RequestParam(required = false) String waveformPeaks,
            @RequestParam(required = false) String strokes,
            @RequestParam(required = false) Double trimStart,
            @RequestParam(required = false) Double trimEnd,
            HttpServletRequest req
    ) {
        Long senderId = callerId(req);
        if (senderId == null) return ResponseEntity.status(401).build();

        try {
            String fileUrl;
            if ("VIDEO".equalsIgnoreCase(type) && trimStart != null && trimEnd != null) {
                String orig = file.getOriginalFilename();
                String ext = (orig != null && orig.contains(".")) ? orig.substring(orig.lastIndexOf('.') + 1) : "mp4";
                byte[] trimmed = videoTrimService.trim(file.getBytes(), ext, trimStart, trimEnd);
                fileUrl = r2Storage.uploadBytes(trimmed, "video/mp4", "trimmed.mp4", type.toLowerCase());
            } else if ("IMAGE".equalsIgnoreCase(type) && strokes != null && !strokes.isBlank()) {
                byte[] marked = imageMarkupService.applyStrokes(file.getBytes(), strokes);
                fileUrl = r2Storage.uploadBytes(marked, "image/png", "marked.png", type.toLowerCase());
            } else {
                fileUrl = r2Storage.upload(file, type.toLowerCase());
            }

            // ── Group upload ──
            if (groupId != null) {
                GroupMessageDTO saved = groupService.sendMessage(groupId, senderId, content, type.toUpperCase(), fileUrl);
                messagingTemplate.convertAndSend("/topic/group/" + groupId, saved);
                return ResponseEntity.ok(saved);
            }

            // ── DM upload ──
            if (receiverId == null) {
                return ResponseEntity.badRequest().body("Either receiverId or groupId is required");
            }

            MessageDTO dto = new MessageDTO();
            dto.setSenderId(senderId);
            dto.setReceiverId(receiverId);
            dto.setType(type.toUpperCase());
            dto.setFileUrl(fileUrl);
            dto.setEdited(false);
            // durationSeconds was previously accepted as a request param
            // but never actually assigned to the DTO here — DM voice notes
            // were silently losing their duration on every upload.
            dto.setDurationSeconds(durationSeconds);
            dto.setWaveformPeaks(waveformPeaks);
            if (content != null && !content.isBlank()) dto.setContent(content);
            if (replyToId != null) {
                try { dto.setReplyToId(Long.parseLong(replyToId)); } catch (NumberFormatException ignored) {}
            }
            if (replyPreview != null) dto.setReplyPreview(replyPreview);

            MessageDTO saved = messageService.saveMessage(dto);

            messagingTemplate.convertAndSend("/topic/messages/" + receiverId, saved);
            messagingTemplate.convertAndSend("/topic/messages/" + senderId,   saved);

            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Upload failed: " + e.getMessage());
        }
    }
}
