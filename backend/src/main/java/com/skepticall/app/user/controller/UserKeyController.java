package com.skepticall.app.user.controller;

import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.exceptions.ErrorType;
import com.skepticall.app.user.dto.PublicKeyDTO;
import com.skepticall.app.user.service.PublicKeyService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Public-key history and rerolling. All routes require a logged-in user. */
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserKeyController {

    private final PublicKeyService publicKeyService;

    private Long callerId(HttpServletRequest req) {
        Long id = (Long) req.getAttribute("authenticatedUserId");
        if (id == null) {
            throw new BusinessException(ErrorType.INVALID_TOKEN, "Not authenticated");
        }
        return id;
    }

    /** My current key plus my retired keys that are still valid (so I know which private keys to keep). */
    @GetMapping("/me/public-keys")
    public ResponseEntity<List<PublicKeyDTO>> myKeys(HttpServletRequest req) {
        return ResponseEntity.ok(publicKeyService.validKeys(callerId(req)));
    }

    /** Someone's current key plus their still-valid retired keys (needed to open their older messages). */
    @GetMapping("/{id}/public-keys")
    public ResponseEntity<List<PublicKeyDTO>> keysOf(@PathVariable Long id, HttpServletRequest req) {
        callerId(req);
        return ResponseEntity.ok(publicKeyService.validKeys(id));
    }

    /**
     * Reroll my public key. Body: {"publicKey": "<base64 X25519>", "password": "<my password>"}.
     * The old key stays valid for the grace period (30 days by default).
     */
    @PostMapping("/me/public-key/rotate")
    public ResponseEntity<List<PublicKeyDTO>> rotate(@RequestBody Map<String, String> body, HttpServletRequest req) {
        return ResponseEntity.ok(
                publicKeyService.rotate(callerId(req), body.get("publicKey"), body.get("password")));
    }
}
