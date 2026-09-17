package net.omnimedia.omni.captcha.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Verifies Google reCAPTCHA v2 tokens server-side.
 *
 * A captcha checkbox on the frontend alone is NOT a real security control —
 * anyone can call POST /users/register directly and skip the widget entirely.
 * The token returned by the widget must be re-verified here, against Google's
 * API, using the SECRET key (never exposed to the browser) before we trust it.
 */
@Service
public class CaptchaService {

    private static final Logger log = LoggerFactory.getLogger(CaptchaService.class);
    private static final String VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${recaptcha.secret-key:}")
    private String secretKey;

    @Value("${recaptcha.enabled:true}")
    private boolean enabled;

    /**
     * Returns true if the token is valid. Fails closed: any error talking to
     * Google, a missing secret key, or a missing/blank token all result in
     * rejection rather than silently letting the request through.
     */
    public boolean verify(String token) {
        if (!enabled) {
            log.warn("Captcha verification is disabled via recaptcha.enabled=false — do not run this in production.");
            return true;
        }
        if (secretKey == null || secretKey.isBlank()) {
            log.error("recaptcha.secret-key is not configured — rejecting captcha verification.");
            return false;
        }
        if (token == null || token.isBlank()) {
            return false;
        }

        try {
            String form = "secret=" + secretKey + "&response=" + token;
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(VERIFY_URL))
                    .timeout(Duration.ofSeconds(5))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(form))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            Map<?, ?> body = objectMapper.readValue(response.body(), Map.class);
            Object success = body.get("success");
            return Boolean.TRUE.equals(success);
        } catch (HttpTimeoutException e) {
            log.error("Captcha verification timed out", e);
            return false;
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.error("Captcha verification failed", e);
            return false;
        }
    }
}
