package net.omnimedia.omni.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Pings this service's own public URL every 14 minutes so Render's free tier
 * doesn't spin it down after 15 idle minutes.
 *
 * - Render sets RENDER_EXTERNAL_URL on every web service automatically. When
 *   it's missing (local dev) this does nothing.
 * - Scheduling is already enabled on OmniApplication.
 * - It only keeps an AWAKE instance awake: if the service has already slept
 *   or just redeployed, nothing inside it can wake it. That's what the
 *   GitHub Action (.github/workflows/keep-alive.yml) is for.
 */
@Component
public class KeepAliveScheduler {

    private static final Logger log = LoggerFactory.getLogger(KeepAliveScheduler.class);

    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final String baseUrl;

    public KeepAliveScheduler(@Value("${RENDER_EXTERNAL_URL:}") String baseUrl) {
        this.baseUrl = baseUrl == null ? "" : baseUrl.replaceAll("/+$", "");
    }

    @Scheduled(initialDelay = 60_000, fixedDelay = 14 * 60_000)
    public void ping() {
        if (baseUrl.isBlank()) return;
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + "/ping"))
                    .timeout(Duration.ofSeconds(20))
                    .GET()
                    .build();
            HttpResponse<Void> response = client.send(request, HttpResponse.BodyHandlers.discarding());
            log.info("keep-alive ping {}/ping -> {}", baseUrl, response.statusCode());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("keep-alive ping failed: {}", e.toString());
        }
    }
}
