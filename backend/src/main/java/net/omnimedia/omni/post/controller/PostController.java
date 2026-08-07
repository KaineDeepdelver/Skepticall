package net.omnimedia.omni.post.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.post.dto.PostDTO;
import net.omnimedia.omni.post.service.PostService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

@RestController @RequestMapping("/posts") @RequiredArgsConstructor @CrossOrigin(origins = "*")
public class PostController {
    private final PostService postService;

    private Long callerId(HttpServletRequest req) {
        return (Long) req.getAttribute("authenticatedUserId");
    }

    @GetMapping
    public List<PostDTO> getFeed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest req) {
        // viewerId is now derived from the token (if present) instead of a query param,
        // so vote-state personalization can't be spoofed for another user
        return postService.getFeed(page, size, callerId(req));
    }

    @GetMapping("/slug/{slug}")
    public ResponseEntity<PostDTO> getBySlug(@PathVariable String slug, HttpServletRequest req) {
            return ResponseEntity.ok(postService.getBySlug(slug, callerId(req)));
    }

    @GetMapping("/user/{authorId}")
    public List<PostDTO> getUserPosts(
            @PathVariable Long authorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest req) {
        return postService.getUserPosts(authorId, page, size, callerId(req));
    }

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<PostDTO> create(
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String content,
            @RequestParam(value = "media", required = false) List<MultipartFile> mediaFiles,
            HttpServletRequest req
    ) throws IOException {
        Long authorId = callerId(req);
        if (authorId == null) return ResponseEntity.status(401).build();

        boolean hasContent = content != null && !content.isBlank();
        boolean hasMedia   = mediaFiles != null && mediaFiles.stream().anyMatch(f -> f != null && !f.isEmpty());
        if (!hasContent && !hasMedia) return ResponseEntity.badRequest().build();

        Path dir = Paths.get("uploads");
        Files.createDirectories(dir);

        List<String[]> mediaEntries = new ArrayList<>();
        if (hasMedia) {
            for (MultipartFile file : mediaFiles) {
                if (file == null || file.isEmpty()) continue;
                String mime = file.getContentType() != null ? file.getContentType() : "";
                String mediaType;
                if      (mime.equals("image/gif"))     mediaType = "GIF";
                else if (mime.startsWith("image/"))    mediaType = "IMAGE";
                else if (mime.startsWith("video/"))    mediaType = "VIDEO";
                else {
                    // 🧼 Upgraded: Using your custom exception engine
                    throw new BusinessException(
                            ErrorType.INVALID_OPERATION,
                            "Invalid file format uploaded. Only images, videos, and GIFs are allowed on posts [contentType=" + mime + "]"
                    );
                }

                String ext = Optional.ofNullable(file.getOriginalFilename())
                        .filter(n -> n.contains("."))
                        .map(n -> n.substring(n.lastIndexOf('.')))
                        .orElse("");
                String filename = "post_" + UUID.randomUUID() + ext;
                Files.copy(file.getInputStream(), dir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);
                mediaEntries.add(new String[]{ mediaType, "/uploads/" + filename });
            }
        }

        return ResponseEntity.ok(postService.create(authorId, title, content, mediaEntries));
    }


    @PostMapping("/{id}/vote")
    public ResponseEntity<?> vote(
            @PathVariable Long id,
            @RequestParam String voteType,
            HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(postService.vote(id, userId, voteType.toUpperCase()));
    }

    @GetMapping("/search")
    public List<PostDTO> search(@RequestParam String q, HttpServletRequest req) {
        return postService.search(q, callerId(req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
            postService.delete(id, userId);
            return ResponseEntity.noContent().build();
    }
}
