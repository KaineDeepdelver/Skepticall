package net.omnimedia.omni.network.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.config.R2StorageService;
import net.omnimedia.omni.network.dto.ChannelDTO;
import net.omnimedia.omni.network.dto.ChannelMessageDTO;
import net.omnimedia.omni.network.entity.Channel;
import net.omnimedia.omni.network.entity.ChannelMessage;
import net.omnimedia.omni.network.service.ChannelService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/networks/{networkId}/channels")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ChannelController {
    private final ChannelService channelService;
    private final SimpMessagingTemplate messagingTemplate;
    private final R2StorageService r2Storage;

    private Long callerId(HttpServletRequest req) {
        return (Long) req.getAttribute("authenticatedUserId");
    }

    @GetMapping
    public ResponseEntity<?> list(@PathVariable Long networkId, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(channelService.listChannels(networkId, requesterId));
    }

    /** POST /networks/{networkId}/channels  body: { name, type: TEXT|VOICE|ANNOUNCEMENT, position?, categoryId? } */
    @PostMapping
    public ResponseEntity<?> create(@PathVariable Long networkId, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        String name = body.get("name").toString();
        Channel.Type type = Channel.Type.valueOf(body.get("type").toString().toUpperCase());
        Integer position = body.containsKey("position") ? Integer.valueOf(body.get("position").toString()) : null;
        Long categoryId = body.containsKey("categoryId") && body.get("categoryId") != null ? Long.parseLong(body.get("categoryId").toString()) : null;
        ChannelDTO channel = channelService.createChannel(networkId, requesterId, name, type, position, categoryId);
        return ResponseEntity.ok(channel);
    }

    /** PATCH /networks/{networkId}/channels/{channelId}/category  body: { categoryId } (null clears it) */
    @PatchMapping("/{channelId}/category")
    public ResponseEntity<?> moveToCategory(@PathVariable Long networkId, @PathVariable Long channelId, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        Long categoryId = body.get("categoryId") != null ? Long.parseLong(body.get("categoryId").toString()) : null;
        return ResponseEntity.ok(channelService.moveToCategory(networkId, requesterId, channelId, categoryId));
    }

    @PatchMapping("/{channelId}")
    public ResponseEntity<?> rename(@PathVariable Long networkId, @PathVariable Long channelId, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(channelService.renameChannel(networkId, requesterId, channelId, body.get("name").toString()));
    }

    @DeleteMapping("/{channelId}")
    public ResponseEntity<?> delete(@PathVariable Long networkId, @PathVariable Long channelId, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        channelService.deleteChannel(networkId, requesterId, channelId);
        return ResponseEntity.noContent().build();
    }

    // ── Messages ────────────────────────────────────────────────────────

    @GetMapping("/{channelId}/messages")
    public ResponseEntity<Page<ChannelMessageDTO>> getMessages(
            @PathVariable Long networkId, @PathVariable Long channelId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(channelService.getMessages(networkId, requesterId, channelId, page, size));
    }

    /** POST /networks/{networkId}/channels/{channelId}/messages  body: { content, fileUrl?, parentId? } */
    @PostMapping("/{channelId}/messages")
    public ResponseEntity<?> postMessage(@PathVariable Long networkId, @PathVariable Long channelId, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long senderId = callerId(req);
        if (senderId == null) return ResponseEntity.status(401).build();
        String content = body.containsKey("content") ? body.get("content").toString() : null;
        String fileUrl = body.containsKey("fileUrl") ? body.get("fileUrl").toString() : null;
        Long parentId = body.containsKey("parentId") && body.get("parentId") != null
                ? Long.parseLong(body.get("parentId").toString()) : null;
        ChannelMessageDTO saved = channelService.postMessage(networkId, channelId, senderId, content, fileUrl, parentId);
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, saved);
        return ResponseEntity.ok(saved);
    }

    /**
     * POST /networks/{networkId}/channels/{channelId}/messages/upload
     * multipart/form-data: file, durationSeconds?, parentId?
     * Voice-note upload for network channels — same shape as
     * MessageRestController#uploadMessage (DMs/groups), routed through the
     * channel's own postMessage() so permissions, mention-parsing, and
     * reply-threading all apply identically to a voice note as to text.
     */
    @PostMapping(value = "/{channelId}/messages/upload", consumes = "multipart/form-data")
    public ResponseEntity<?> uploadVoiceMessage(
            @PathVariable Long networkId, @PathVariable Long channelId,
            @RequestParam MultipartFile file,
            @RequestParam(required = false) Integer durationSeconds,
            @RequestParam(required = false) Long parentId,
            @RequestParam(required = false) String waveformPeaks,
            HttpServletRequest req) {
        Long senderId = callerId(req);
        if (senderId == null) return ResponseEntity.status(401).build();
        String fileUrl = r2Storage.upload(file, "channel-voice");
        ChannelMessageDTO saved = channelService.postMessage(
                networkId, channelId, senderId, null, fileUrl, parentId,
                ChannelMessage.MediaType.VOICE, durationSeconds, waveformPeaks);
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, saved);
        return ResponseEntity.ok(saved);
    }

    @PatchMapping("/{channelId}/messages/{messageId}")
    public ResponseEntity<?> editMessage(@PathVariable Long networkId, @PathVariable Long channelId, @PathVariable Long messageId, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        ChannelMessageDTO updated = channelService.editMessage(networkId, requesterId, messageId, body.get("content").toString());
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, updated);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{channelId}/messages/{messageId}")
    public ResponseEntity<?> deleteMessage(@PathVariable Long networkId, @PathVariable Long channelId, @PathVariable Long messageId, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        channelService.deleteMessage(networkId, requesterId, messageId);
        // Broadcast the delete so it's live for everyone in the channel,
        // not just reflected on next reload. Payload is deliberately
        // minimal (not a full ChannelMessageDTO — the message is gone,
        // there's nothing more to describe) with a type tag so the
        // frontend can tell this apart from a normal posted-message
        // broadcast on the same topic and handle it differently: remove
        // it from its own list, AND patch any other loaded message whose
        // parentId matches this id to show "Original message was deleted"
        // immediately instead of waiting for a refetch.
        messagingTemplate.convertAndSend("/topic/channel/" + channelId,
            (Object) Map.of("wsEvent", "MESSAGE_DELETED", "id", messageId, "channelId", channelId));
        return ResponseEntity.noContent().build();
    }
}
