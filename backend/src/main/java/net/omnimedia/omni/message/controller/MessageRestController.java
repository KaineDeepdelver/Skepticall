package net.omnimedia.omni.message.controller;

import jakarta.servlet.http.HttpServletRequest;
import net.omnimedia.omni.config.R2StorageService;
import net.omnimedia.omni.group.dto.GroupMessageDTO;
import net.omnimedia.omni.group.service.GroupService;
import net.omnimedia.omni.message.dto.ConversationDTO;
import net.omnimedia.omni.message.dto.MessageDTO;
import net.omnimedia.omni.message.service.MessageService;
import net.omnimedia.omni.notification.service.PushNotificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.omnimedia.omni.group.dto.GroupMessageKeyDTO;
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
    @Autowired private net.omnimedia.omni.message.util.VideoTrimService videoTrimService;
    // == Jackson ==
    // Instantiated directly — no ObjectMapper bean exists in this app's context,
    // so @Autowired here fails and the whole server crashes on boot. Only used
    // to parse recipientKeysJson; same approach as PushNotificationService.
    private final ObjectMapper objectMapper = new ObjectMapper();
    @Autowired private net.omnimedia.omni.message.util.ImageMarkupService imageMarkupService;
    @Autowired private PushNotificationService pushService;

    private Long callerId(HttpServletRequest req) {
        return (Long) req.getAttribute("authenticatedUserId");
    }

    /** Powers the Call Log tab — every call this user's part of, across every DM, most recent first. */
    @GetMapping("/{userId}/calls")
    public ResponseEntity<?> getCallLog(@PathVariable Long userId, HttpServletRequest req) {
        Long requesterId = callerId(req);
        if (requesterId == null) return ResponseEntity.status(401).build();
        if (!requesterId.equals(userId)) return ResponseEntity.status(403).build();
        return ResponseEntity.ok(messageService.getCallLog(userId));
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
            return ResponseEntity.ok(messageService.editMessage(id, body.get("content"), body.get("nonce"), requesterId));
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
            // Nonce for `content` itself — a media message's CAPTION is
            // still text, encrypted the same way a plain text message is
            // (crypto_box for DM, a wrapped CONTENT key for groups — see
            // recipientKeysJson below). This was missing entirely until
            // now: mediaNonce/mediaKeyCiphertext covered the FILE, but
            // nothing covered the caption, so a caption on an otherwise
            // fully-encrypted photo was still going out as plaintext.
            @RequestParam(required = false) String nonce,
            @RequestParam(required = false) String replyToId,
            @RequestParam(required = false) String replyPreview,
            @RequestParam(required = false) String replyPreviewNonce,
            @RequestParam(required = false) String replyPreviewSender,
            @RequestParam(required = false) Integer durationSeconds,
            @RequestParam(required = false) String waveformPeaks,
            @RequestParam(required = false) String strokes,
            @RequestParam(required = false) Double trimStart,
            @RequestParam(required = false) Double trimEnd,
            @RequestParam(required = false) String _tmpId,
            // E2E media encryption metadata — present only when the client
            // actually encrypted this file (encryptAttachmentFile() in
            // attachments.js skips it for markup/trim sends, since those
            // need the server to read the real bytes above — see the
            // trim/markup branch just below, which is unaffected by any
            // of this and still receives real file bytes either way).
            @RequestParam(required = false) String mediaNonce,
            @RequestParam(required = false) String mediaKeyCiphertext,
            @RequestParam(required = false) String mediaKeyNonce,
            // Group-only — see GroupMessageKey. Multipart form fields
            // can't carry a nested array directly, so the client sends
            // the per-member wrapped-key list as one JSON string and it's
            // parsed back out here, same contract as the WS path's
            // directly-bound List<GroupMessageKeyDTO>.
            @RequestParam(required = false) String recipientKeysJson,
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
                Long parsedReplyToId = null;
                if (replyToId != null) {
                    try { parsedReplyToId = Long.parseLong(replyToId); } catch (NumberFormatException ignored) {}
                }
                List<GroupMessageKeyDTO> recipientKeys = null;
                if (recipientKeysJson != null && !recipientKeysJson.isBlank()) {
                    try {
                        recipientKeys = objectMapper.readValue(recipientKeysJson, objectMapper.getTypeFactory()
                                .constructCollectionType(List.class, GroupMessageKeyDTO.class));
                    } catch (Exception e) {
                        // Malformed JSON from a buggy/old client — fall back to a
                        // plaintext send rather than fail the whole upload outright.
                        recipientKeys = null;
                    }
                }
                GroupMessageDTO saved = groupService.sendMessage(
                        groupId, senderId, content, type.toUpperCase(), fileUrl,
                        parsedReplyToId, replyPreview, replyPreviewSender,
                        nonce, replyPreviewNonce, mediaNonce, recipientKeys);
                messagingTemplate.convertAndSend("/topic/group/" + groupId, saved);
                var groupInfo = groupService.getGroup(groupId);
                if (groupInfo != null) {
                    List<Long> memberIds = groupInfo.getMembers().stream().map(m -> m.getId()).toList();
                    pushService.notifyGroupAttachment(senderId, groupId, groupInfo.getName(), memberIds, type);
                }
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
            dto.setNonce(nonce);
            if (replyToId != null) {
                try { dto.setReplyToId(Long.parseLong(replyToId)); } catch (NumberFormatException ignored) {}
            }
            if (replyPreview != null) dto.setReplyPreview(replyPreview);
            dto.setReplyPreviewNonce(replyPreviewNonce);
            if (replyPreviewSender != null) dto.setReplyPreviewSender(replyPreviewSender);
            dto.setMediaNonce(mediaNonce);
            dto.setMediaKeyCiphertext(mediaKeyCiphertext);
            dto.setMediaKeyNonce(mediaKeyNonce);

            MessageDTO saved = messageService.saveMessage(dto);
            // Echo the client's correlation token back, same as
            // MessageWsController does for text sends — it's not persisted
            // (saveMessage()'s mapper doesn't touch _tmpId), so it has to be
            // re-set on the returned DTO explicitly before broadcasting.
            // Without this, the RN/web clients had no reliable way to match
            // an attachment's WS echo back to the specific optimistic bubble
            // that sent it — they fell back to "the oldest still-pending
            // upload of the same type", which breaks the moment two uploads
            // of the same type are in flight at once (e.g. sending several
            // photos from the multi-select review sheet): a later upload's
            // echo could resolve an earlier upload's placeholder by mistake,
            // and once BOTH uploads' HTTP responses arrived, two list
            // entries could end up sharing the same real id — surfacing as
            // React's "two children with the same key" warning, since the
            // message list's keyExtractor keys primarily on id.
            saved.set_tmpId(_tmpId);

            messagingTemplate.convertAndSend("/topic/messages/" + receiverId, saved);
            messagingTemplate.convertAndSend("/topic/messages/" + senderId,   saved);

            if ("VOICE".equalsIgnoreCase(type)) pushService.notifyVoiceMessage(senderId, receiverId);
            else pushService.notifyAttachment(senderId, receiverId, type);

            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Upload failed: " + e.getMessage());
        }
    }
}
