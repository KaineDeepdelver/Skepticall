package com.skepticall.app.privacy;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Public privacy endpoints (no login needed: the emailed token is the proof). */
@RestController
@RequestMapping("/privacy")
@RequiredArgsConstructor
public class PrivacyController {

    private final PrivacyService privacyService;

    /** Body: {"email": "..."}. Always 202, whether or not an account exists. */
    @PostMapping("/deletion-request")
    public ResponseEntity<Void> requestDeletion(@RequestBody Map<String, String> body) {
        privacyService.requestDeletion(body.get("email"));
        return ResponseEntity.accepted().build();
    }

    /** Body: {"token": "..."} from the emailed link. */
    @PostMapping("/deletion-confirm")
    public ResponseEntity<Void> confirmDeletion(@RequestBody Map<String, String> body) {
        privacyService.confirmDeletion(body.get("token"));
        return ResponseEntity.noContent().build();
    }

    /** Body: {"token": "..."} from the link in an alert email. */
    @PostMapping("/alerts-unsubscribe")
    public ResponseEntity<Void> unsubscribeAlerts(@RequestBody Map<String, String> body) {
        privacyService.unsubscribeAlerts(body.get("token"));
        return ResponseEntity.noContent().build();
    }
}
