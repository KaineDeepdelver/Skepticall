package net.omnimedia.omni.media.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.config.R2StorageService;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.media.dto.MediaItemDTO;
import net.omnimedia.omni.media.service.MediaService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

@RestController @RequestMapping("/media") @RequiredArgsConstructor @CrossOrigin(origins = "*")
public class MediaController {
    private final MediaService mediaService;
    private final R2StorageService r2Storage;

    private Long callerId(HttpServletRequest req) {
        return (Long) req.getAttribute("authenticatedUserId");
    }

    @GetMapping
    public List<MediaItemDTO> getFeed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest req) {
        return mediaService.getFeed(page, size, callerId(req));
    }

    @GetMapping("/clips")
    public List<MediaItemDTO> getClips(HttpServletRequest req) {
        return mediaService.getClips(callerId(req));
    }

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<?> upload(
            @RequestParam String title,
            @RequestParam(required = false) String description,
            @RequestParam MultipartFile video,
            @RequestParam(required = false) MultipartFile thumbnail,
            @RequestParam(defaultValue = "false") boolean isClip,
            @RequestParam(defaultValue = "0") int durationSeconds,
            HttpServletRequest req) throws IOException {

        Long authorId = callerId(req);
        if (authorId == null) return ResponseEntity.status(401).build();

        String mime = video.getContentType() != null ? video.getContentType() : "";
        if (!mime.startsWith("video/")) {
            throw new BusinessException(
                    ErrorType.INVALID_OPERATION,
                    "Only video files are allowed in Media [contentType=" + mime + "]"
            );
        }

        if (isClip && durationSeconds > 300) {
            return ResponseEntity.badRequest().body("Clips cannot exceed 5 minutes (300 seconds).");
        }

        String videoUrl = r2Storage.upload(video, "media");

        String thumbUrl = null;
        if (thumbnail != null && !thumbnail.isEmpty()) {
            thumbUrl = r2Storage.upload(thumbnail, "thumb");
        }

        return ResponseEntity.ok(mediaService.create(authorId, title, description, videoUrl, thumbUrl, isClip, durationSeconds));
    }

    @GetMapping("/search")
    public List<MediaItemDTO> search(@RequestParam String q, HttpServletRequest req) {
        return mediaService.search(q, callerId(req));
    }

    @PostMapping("/{id}/vote")
    public ResponseEntity<?> vote(@PathVariable Long id, @RequestParam String voteType, HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(mediaService.vote(id, userId, voteType.toUpperCase()));
    }

    @PostMapping("/{id}/view")
    public ResponseEntity<MediaItemDTO> view(@PathVariable Long id) {
        return ResponseEntity.ok(mediaService.incrementViews(id));
    }

    @GetMapping("/user/{authorId}")
    public ResponseEntity<List<MediaItemDTO>> getUserMedia(@PathVariable Long authorId, HttpServletRequest req) {
        return ResponseEntity.ok(mediaService.getByAuthor(authorId, callerId(req)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
            mediaService.delete(id, userId);
            return ResponseEntity.noContent().build();
    }
}
