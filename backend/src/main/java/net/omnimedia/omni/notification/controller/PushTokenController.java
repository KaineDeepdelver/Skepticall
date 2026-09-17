package net.omnimedia.omni.notification.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.notification.dto.PushTokenDTO;
import net.omnimedia.omni.notification.entity.PushToken;
import net.omnimedia.omni.notification.repository.PushTokenRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/push-tokens")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PushTokenController {

    private final PushTokenRepository pushTokenRepo;

    private Long callerId(HttpServletRequest req) {
        return (Long) req.getAttribute("authenticatedUserId");
    }

    // Called once the RN app has permission and an Expo push token — on
    // login, and again on cold start if a signed-in user already has one.
    // Upserts by token: the same physical device re-registering (app
    // reinstall, or a different account signing in on it) just moves the
    // existing row onto the new caller instead of creating a duplicate.
    @PostMapping
    public ResponseEntity<?> register(@RequestBody PushTokenDTO body, HttpServletRequest req) {
        Long userId = callerId(req);
        if (userId == null) return ResponseEntity.status(401).build();
        if (body.getToken() == null || body.getToken().isBlank()) {
            return ResponseEntity.badRequest().body("token is required");
        }

        PushToken pt = pushTokenRepo.findByToken(body.getToken())
                .orElseGet(() -> PushToken.builder().token(body.getToken()).build());
        pt.setUserId(userId);
        pt.setPlatform(body.getPlatform());
        pushTokenRepo.save(pt);

        return ResponseEntity.ok().build();
    }

    // Called on logout so a signed-out device stops receiving pushes meant
    // for the account that used to be signed in on it. Deletes by token
    // rather than by caller id — the client is about to clear its own JWT,
    // so it sends the token itself rather than relying on auth surviving
    // long enough to resolve a caller id.
    @DeleteMapping
    public ResponseEntity<Void> unregister(@RequestBody PushTokenDTO body) {
        if (body.getToken() != null && !body.getToken().isBlank()) {
            pushTokenRepo.deleteByToken(body.getToken());
        }
        return ResponseEntity.ok().build();
    }
}
