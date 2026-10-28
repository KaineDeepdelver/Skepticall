package com.skepticall.app.user.controller;

import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.exceptions.ErrorType;
import com.skepticall.app.user.dto.KeyVaultDTO;
import com.skepticall.app.user.service.KeyVaultService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** The account's passphrase-protected key backup, so the key follows the account. All routes need a login. */
@RestController
@RequestMapping("/users/me/key-vault")
@RequiredArgsConstructor
public class UserKeyVaultController {

    private final KeyVaultService keyVaultService;

    private Long callerId(HttpServletRequest req) {
        Long id = (Long) req.getAttribute("authenticatedUserId");
        if (id == null) {
            throw new BusinessException(ErrorType.INVALID_TOKEN, "Not authenticated");
        }
        return id;
    }

    /** My stored key backup, or {"exists": false}. The blob is useless without the recovery phrase. */
    @GetMapping
    public ResponseEntity<KeyVaultDTO> get(HttpServletRequest req) {
        return ResponseEntity.ok(keyVaultService.get(callerId(req)));
    }

    /**
     * Save or replace my key backup.
     * Body: {"blob": "<base64>", "currentPublicKey": "<base64 X25519>", "password": "<my password>"}.
     */
    @PutMapping
    public ResponseEntity<KeyVaultDTO> save(@RequestBody Map<String, String> body, HttpServletRequest req) {
        return ResponseEntity.ok(keyVaultService.save(
                callerId(req), body.get("blob"), body.get("currentPublicKey"), body.get("password")));
    }

    /** Remove my key backup. Body: {"password": "<my password>"}. */
    @DeleteMapping
    public ResponseEntity<Void> delete(@RequestBody Map<String, String> body, HttpServletRequest req) {
        keyVaultService.delete(callerId(req), body.get("password"));
        return ResponseEntity.noContent().build();
    }
}
