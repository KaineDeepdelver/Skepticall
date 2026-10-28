package com.skepticall.app.user.controller;

import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.exceptions.ErrorType;
import com.skepticall.app.user.dto.BlockedUserDTO;
import com.skepticall.app.user.service.BlockService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** The people I have blocked. All routes need a login. */
@RestController
@RequestMapping("/users/me/blocks")
@RequiredArgsConstructor
public class UserBlockController {

    private final BlockService blockService;

    private Long callerId(HttpServletRequest req) {
        Long id = (Long) req.getAttribute("authenticatedUserId");
        if (id == null) {
            throw new BusinessException(ErrorType.INVALID_TOKEN, "Not authenticated");
        }
        return id;
    }

    @GetMapping
    public ResponseEntity<List<BlockedUserDTO>> list(HttpServletRequest req) {
        return ResponseEntity.ok(blockService.list(callerId(req)));
    }

    /** Block a person. Safe to repeat. */
    @PutMapping("/{userId}")
    public ResponseEntity<Void> block(@PathVariable Long userId, HttpServletRequest req) {
        blockService.block(callerId(req), userId);
        return ResponseEntity.noContent().build();
    }

    /** Unblock a person. Safe to repeat. */
    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> unblock(@PathVariable Long userId, HttpServletRequest req) {
        blockService.unblock(callerId(req), userId);
        return ResponseEntity.noContent().build();
    }
}
