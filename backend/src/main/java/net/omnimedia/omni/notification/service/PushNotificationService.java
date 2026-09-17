package net.omnimedia.omni.notification.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.omnimedia.omni.notification.entity.PushToken;
import net.omnimedia.omni.notification.repository.PushTokenRepository;
import net.omnimedia.omni.user.entity.User;
import net.omnimedia.omni.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// Sends push notifications (the OS-level kind — lock screen, notification
// tray — as opposed to the in-app Notification entity/bell icon this app
// already had) through Expo's push service:
// https://exp.host/--/api/v2/push/send
//
// Expo's service is what actually talks to FCM (Android) and APNs (iOS)
// on our behalf, so nothing here deals with Firebase or Apple credentials
// directly — that's all handled on the RN app's build/EAS side, not here.
@Service
@RequiredArgsConstructor
@Slf4j
public class PushNotificationService {

    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
    private static final int BATCH_SIZE = 100; // Expo's documented per-request cap

    private final PushTokenRepository pushTokenRepo;
    private final UserRepository userRepo;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    // Optional — only needed if you enable Expo's "enhanced security"
    // access-token requirement for the push API. Leave EXPO_ACCESS_TOKEN
    // unset and this is simply omitted from the request.
    @Value("${expo.push.access-token:}")
    private String expoAccessToken;

    // == Semantic event methods ===============================================
    // sendToUser/sendBatch above are the low-level plumbing (already
    // existed); these are the actual call sites message/call controllers
    // use — added alongside them so display-name resolution and wording
    // live in one place instead of being duplicated at every controller.

    @Async("pushExecutor")
    public void notifyMessage(Long senderId, Long receiverId, String preview) {
        sendToUser(receiverId, displayName(senderId), preview != null ? preview : "Sent you a message",
                Map.of("type", "message", "senderId", senderId));
    }

    @Async("pushExecutor")
    public void notifyVoiceMessage(Long senderId, Long receiverId) {
        sendToUser(receiverId, displayName(senderId), "🎤 Voice message",
                Map.of("type", "message", "senderId", senderId));
    }

    @Async("pushExecutor")
    public void notifyAttachment(Long senderId, Long receiverId, String kind) {
        sendToUser(receiverId, displayName(senderId), attachmentPreview(kind),
                Map.of("type", "message", "senderId", senderId));
    }

    @Async("pushExecutor")
    public void notifyGroupMessage(Long senderId, Long groupId, String groupName, List<Long> memberIds, String preview) {
        String name = displayName(senderId);
        for (Long id : recipientsExcluding(memberIds, senderId)) {
            sendToUser(id, groupName, name + ": " + (preview != null ? preview : "Sent a message"),
                    Map.of("type", "groupMessage", "groupId", groupId));
        }
    }

    @Async("pushExecutor")
    public void notifyGroupAttachment(Long senderId, Long groupId, String groupName, List<Long> memberIds, String kind) {
        String name = displayName(senderId);
        for (Long id : recipientsExcluding(memberIds, senderId)) {
            sendToUser(id, groupName, name + ": " + attachmentPreview(kind),
                    Map.of("type", "groupMessage", "groupId", groupId));
        }
    }

    @Async("pushExecutor")
    public void notifyCall(Long callerId, Long calleeId, boolean video) {
        sendToUser(calleeId, displayName(callerId), video ? "📹 Incoming video call" : "📞 Incoming voice call",
                Map.of("type", "call", "callerId", callerId, "video", video));
    }

    @Async("pushExecutor")
    public void notifyGroupCall(Long callerId, Long groupId, String groupName, List<Long> memberIds, boolean video) {
        String name = displayName(callerId);
        for (Long id : recipientsExcluding(memberIds, callerId)) {
            sendToUser(id, groupName, name + (video ? " started a video call" : " started a voice call"),
                    Map.of("type", "groupCall", "groupId", groupId));
        }
    }

    private List<Long> recipientsExcluding(List<Long> memberIds, Long exclude) {
        return memberIds.stream().filter(id -> !id.equals(exclude)).collect(Collectors.toList());
    }

    private String attachmentPreview(String kind) {
        if (kind == null) return "Sent an attachment";
        return switch (kind.toUpperCase()) {
            case "IMAGE" -> "📷 Photo";
            case "VIDEO" -> "🎥 Video";
            case "GIF" -> "GIF";
            case "FILE" -> "📎 File";
            default -> "Sent an attachment";
        };
    }

    private String displayName(Long userId) {
        User u = userRepo.findById(userId).orElse(null);
        if (u == null) return "Someone";
        return (u.getDisplayName() != null && !u.getDisplayName().isBlank()) ? u.getDisplayName() : u.getUsername();
    }

    // Fire-and-forget: runs on the "pushExecutor" pool (see AsyncConfig)
    // so a slow/unavailable Expo API never adds latency to the request
    // that triggered the notification (sending a message, calling, etc).
    public void sendToUser(Long userId, String title, String body, Map<String, Object> data) {
        List<PushToken> tokens = pushTokenRepo.findByUserId(userId);
        if (tokens.isEmpty()) return;

        for (int i = 0; i < tokens.size(); i += BATCH_SIZE) {
            List<PushToken> batch = tokens.subList(i, Math.min(i + BATCH_SIZE, tokens.size()));
            sendBatch(batch, title, body, data);
        }
    }

    private void sendBatch(List<PushToken> batch, String title, String body, Map<String, Object> data) {
        try {
            ArrayNode messages = objectMapper.createArrayNode();
            for (PushToken pt : batch) {
                ObjectNode msg = objectMapper.createObjectNode();
                msg.put("to", pt.getToken());
                msg.put("title", title);
                msg.put("body", body);
                msg.put("sound", "default");
                msg.put("priority", "high");
                msg.put("channelId", "default"); // matches the Android channel the RN app creates
                if (data != null) msg.set("data", objectMapper.valueToTree(data));
                messages.add(msg);
            }

            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(EXPO_PUSH_URL))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json");
            if (expoAccessToken != null && !expoAccessToken.isBlank()) {
                reqBuilder.header("Authorization", "Bearer " + expoAccessToken);
            }
            HttpRequest request = reqBuilder
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(messages)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warn("Expo push send failed with HTTP {}: {}", response.statusCode(), response.body());
                return;
            }
            pruneDeadTokens(batch, response.body());
        } catch (Exception e) {
            // Push delivery is best-effort — a failure here must never
            // bubble up into the message/follow/call flow that triggered it.
            log.warn("Expo push send threw an exception", e);
        }
    }

    // Expo returns one "ticket" per message, in the same order they were
    // sent. A DeviceNotRegistered error means the app was uninstalled or
    // the token rotated — that token is now permanently dead, so it's
    // removed rather than retried forever on every future notification.
    private void pruneDeadTokens(List<PushToken> batch, String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode tickets = root.path("data");
            if (!tickets.isArray()) return;

            for (int i = 0; i < tickets.size() && i < batch.size(); i++) {
                JsonNode ticket = tickets.get(i);
                if (!"error".equals(ticket.path("status").asText())) continue;

                String errorCode = ticket.path("details").path("error").asText("");
                if ("DeviceNotRegistered".equals(errorCode)) {
                    pushTokenRepo.deleteByToken(batch.get(i).getToken());
                    log.info("Removed stale push token for user {}", batch.get(i).getUserId());
                } else {
                    log.warn("Expo push ticket error for user {}: {}", batch.get(i).getUserId(), ticket);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to parse Expo push response", e);
        }
    }
}
