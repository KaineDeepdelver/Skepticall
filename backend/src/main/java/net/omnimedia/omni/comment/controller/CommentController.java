package net.omnimedia.omni.comment.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.comment.dto.CommentDTO;
import net.omnimedia.omni.comment.service.CommentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/comments") @RequiredArgsConstructor @CrossOrigin(origins = "*")
public class CommentController {
    private final CommentService commentService;

    private Long callerId(HttpServletRequest req) {
        return (Long) req.getAttribute("authenticatedUserId");
    }

    @GetMapping("/post/{postId}")
    public List<CommentDTO> getForPost(@PathVariable Long postId, HttpServletRequest req) {
        return commentService.getForPost(postId, callerId(req));
    }

    @GetMapping("/media/{mediaId}")
    public List<CommentDTO> getForMedia(@PathVariable Long mediaId, HttpServletRequest req) {
        return commentService.getForMedia(mediaId, callerId(req));
    }

    @PostMapping("/post/{postId}")
    public ResponseEntity<?> addToPost(@PathVariable Long postId, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long authorId = callerId(req);
        if (authorId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(commentService.addToPost(postId, authorId, body.get("content").toString()));
    }

    @PostMapping("/media/{mediaId}")
    public ResponseEntity<?> addToMedia(@PathVariable Long mediaId, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long authorId = callerId(req);
        if (authorId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(commentService.addToMedia(mediaId, authorId, body.get("content").toString()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
            commentService.delete(id, userId);
            return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/vote")
    public ResponseEntity<?> vote(@PathVariable Long id, @RequestParam String voteType, HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(commentService.vote(id, userId, voteType.toUpperCase()));
    }

    @GetMapping("/{id}/replies")
    public List<CommentDTO> getReplies(@PathVariable Long id, HttpServletRequest req) {
        return commentService.getReplies(id, callerId(req));
    }

    @PostMapping("/{id}/reply")
    public ResponseEntity<?> reply(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long authorId = callerId(req);
        if (authorId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(commentService.addReply(id, authorId, body.get("content").toString()));
    }

    @PostMapping("/{id}/react")
    public ResponseEntity<?> react(@PathVariable Long id, @RequestParam String emoji, HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(commentService.toggleReaction(id, userId, emoji));
    }
}
