package net.omnimedia.omni.user.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.message.service.MessageService;
import net.omnimedia.omni.user.dto.*;
import net.omnimedia.omni.user.service.UserService;
import net.omnimedia.omni.verification.entity.VerificationCode;
import net.omnimedia.omni.verification.service.VerificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;
    private final VerificationService verificationService;

    @Autowired
    private MessageService messageService;

    private Long callerId(HttpServletRequest req) {
        return (Long) req.getAttribute("authenticatedUserId");
    }

    // == Auth =================================================================

    @PostMapping("/register")
    public ResponseEntity<LoginResponseDTO> register(@RequestBody RegisterDTO dto) {
        return ResponseEntity.ok(userService.register(dto));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginDTO dto) {
         return ResponseEntity.ok(userService.login(dto));
    }

    // == Checks ===============================================================

    @PostMapping("/check-email")
    public ResponseEntity<Boolean> checkEmail(@RequestBody RegisterDTO request) {
        return ResponseEntity.ok(userService.emailExists(request.getEmail()));
    }

    @PostMapping("/check-username")
    public ResponseEntity<Boolean> checkUsername(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(userService.usernameExists(body.get("username")));
    }

    // == Queries ==============================================================

    /** Public profile — no sensitive fields, no auth required */
    @GetMapping("/{id}")
    public ResponseEntity<UserPublicDTO> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getPublicUser(id));
    }

    /** Resolve a username → public profile. Used by frontend username-based URLs. */
    @GetMapping("/by-username/{username}")
    public ResponseEntity<UserPublicDTO> getUserByUsername(@PathVariable String username) {
            return ResponseEntity.ok(userService.getPublicUserByUsername(username));
    }

    /** Own profile — full data including settings. JWT must match {id}. */
    @GetMapping("/{id}/me")
    public ResponseEntity<?> getMe(@PathVariable Long id, HttpServletRequest req) {
            userService.requireSelf(callerId(req), id);
            return ResponseEntity.ok(userService.getUser(id));
    }

    /** Search returns public profiles only */
    @GetMapping("/search")
    public ResponseEntity<List<UserPublicDTO>> searchUsers(@RequestParam String query) {
        return ResponseEntity.ok(userService.searchUsersPublic(query));
    }

    @GetMapping("/{id}/conversations")
    public ResponseEntity<?> getConversations(@PathVariable Long id, HttpServletRequest req) {
            userService.requireSelf(callerId(req), id);
            return ResponseEntity.ok(messageService.getUserConversations(id));
    }

    // == Updates — JWT-authenticated caller must own {id} (or be an admin) ===

    @PutMapping("/{id}/profile")
    public ResponseEntity<?> updateProfile(
            @PathVariable Long id,
            @RequestParam(required = false) String displayName,
            @RequestParam(required = false) String bio,
            @RequestParam(required = false) MultipartFile file,
            @RequestParam(required = false) MultipartFile banner,
            HttpServletRequest req
    ) {
            userService.requireSelf(callerId(req), id);
            return ResponseEntity.ok(userService.updateProfile(id, displayName, bio, file, banner));
    }

    @PutMapping("/{id}/account")
    public ResponseEntity<?> updateAccount(@PathVariable Long id, @RequestBody Map<String, String> body, HttpServletRequest req) {
            userService.requireSelf(callerId(req), id);
            return ResponseEntity.ok(userService.updateAccount(id, body));
    }

    @PutMapping("/{id}/privacy")
    public ResponseEntity<?> updatePrivacy(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest req) {
            userService.requireSelf(callerId(req), id);
            boolean mode = Boolean.TRUE.equals(body.get("privacyMode"));
            return ResponseEntity.ok(userService.updatePrivacy(id, mode));
    }

    /** Self-delete — requires the account's own password to confirm */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAccount(@PathVariable Long id, @RequestBody Map<String, String> body, HttpServletRequest req) {
        try {
            userService.requireSelf(callerId(req), id);
            userService.deleteAccount(id, body.get("password"));
            return ResponseEntity.noContent().build();
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // == Presence =============================================================
    // Best-effort: tab-close beacons may race the token being attached, so we only
    // hard-block when a token IS present and belongs to someone else.

    @PutMapping("/{id}/presence")
    public ResponseEntity<Void> setPresence(@PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long caller = callerId(req);
        if (caller != null && !caller.equals(id)) return ResponseEntity.status(403).build();
        boolean online = Boolean.TRUE.equals(body.get("online"));
        userService.setOnline(id, online);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/presence")
    public ResponseEntity<Map<String, Object>> getPresence(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getPresence(id));
    }

    // == Email Verification ===================================================

    @PostMapping("/send-registration-code")
    public ResponseEntity<?> sendRegistrationCode(@RequestBody Map<String, String> body) {
            verificationService.sendRegistrationCode(body.get("email"));
            return ResponseEntity.ok().build();
    }

    @PostMapping("/verify-registration-code")
    public ResponseEntity<?> verifyRegistrationCode(@RequestBody Map<String, String> body) {
            verificationService.verifyCode(
                    body.get("email"),
                    body.get("code"),
                    VerificationCode.CodeType.REGISTRATION
            );
            return ResponseEntity.ok().build();
    }

    // == Forgot Password ======================================================

    @PostMapping("/send-reset-code")
    public ResponseEntity<?> sendResetCode(@RequestBody Map<String, String> body) {
            verificationService.sendForgotPasswordCode(body.get("email"));
            return ResponseEntity.ok().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
            userService.resetPassword(
                    body.get("email"),
                    body.get("code"),
                    body.get("newPassword")
            );
            return ResponseEntity.ok().build();
    }
}
