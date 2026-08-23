package net.omnimedia.omni.network.controller;

import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.network.entity.Channel;
import net.omnimedia.omni.network.service.ChannelService;
import net.omnimedia.omni.network.service.VoiceChannelPresenceService;
import net.omnimedia.omni.user.entity.User;
import net.omnimedia.omni.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.context.event.EventListener;

import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Signaling for network VOICE channels — join/leave/mute presence plus
 * WebRTC offer/answer/ICE relay for a mesh topology (every participant
 * connects directly to every other participant). That ceiling is fine for
 * the small-room case this is built for; it is not an SFU and won't scale
 * to large rooms — each additional participant adds a peer connection to
 * everyone else already there.
 * <p>
 * Everything broadcasts over the same "/topic/channel/{channelId}" topic
 * that ChannelView.js already subscribes to for text messages (see
 * WebSocketContext.js#subscribeToChannel), so no new subscription plumbing
 * is needed on the frontend — voice events are just a different "_type" on
 * the same stream, and clients that don't recognize a VOICE_* type ignore it.
 */
@Controller
public class VoiceChannelWsController {

    @Autowired private SimpMessagingTemplate messaging;
    @Autowired private ChannelService channelService;
    @Autowired private VoiceChannelPresenceService presence;
    @Autowired private UserRepository userRepository;

    private Long uid(Principal principal) {
        if (principal == null) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Unauthenticated WebSocket session access attempted");
        }
        return Long.valueOf(principal.getName());
    }

    @MessageMapping("/voice.join")
    public void join(Map<String, Object> payload, Principal principal, SimpMessageHeaderAccessor headerAccessor) {
        Long userId = uid(principal);
        Long channelId = asLong(payload.get("channelId"));
        Channel channel = channelService.requireChannelForMember(channelId, userId);
        if (channel.getType() != Channel.Type.VOICE) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "Not a voice channel");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User not found"));
        String name = user.getDisplayName() != null && !user.getDisplayName().isBlank()
                ? user.getDisplayName() : user.getUsername();

        Long previousChannelId = presence.join(channelId, userId, name, user.getProfilePicture(), headerAccessor.getSessionId());
        if (previousChannelId != null) broadcastRoster(previousChannelId);
        broadcastRoster(channelId);
    }

    @MessageMapping("/voice.leave")
    public void leave(Map<String, Object> payload, Principal principal) {
        Long userId = uid(principal);
        Long channelId = asLong(payload.get("channelId"));
        presence.leave(channelId, userId);
        broadcastRoster(channelId);
    }

    @MessageMapping("/voice.mute")
    public void mute(Map<String, Object> payload, Principal principal) {
        Long userId = uid(principal);
        Long channelId = asLong(payload.get("channelId"));
        boolean muted = Boolean.TRUE.equals(payload.get("muted"));
        presence.setMuted(channelId, userId, muted);
        broadcastRoster(channelId);
    }

    // == WebRTC mesh signaling relay — targeted by targetUserId, everyone in
    //    the channel receives it over the shared topic and self-filters. ===

    @MessageMapping("/voice.offer")
    public void offer(Map<String, Object> payload, Principal principal) {
        relay("VOICE_OFFER", payload, principal);
    }

    @MessageMapping("/voice.answer")
    public void answer(Map<String, Object> payload, Principal principal) {
        relay("VOICE_ANSWER", payload, principal);
    }

    @MessageMapping("/voice.ice")
    public void ice(Map<String, Object> payload, Principal principal) {
        relay("VOICE_ICE", payload, principal);
    }

    private void relay(String type, Map<String, Object> payload, Principal principal) {
        Long userId = uid(principal);
        Long channelId = asLong(payload.get("channelId"));
        // Membership isn't re-checked on every single ICE candidate for
        // signaling volume's sake — join() already gated entry to the room,
        // and a non-member has no channelId to send one for in the first
        // place since the frontend only knows it from having already joined.
        Map<String, Object> out = new HashMap<>(payload);
        out.put("_type", type);
        out.put("senderId", userId);
        messaging.convertAndSend("/topic/channel/" + channelId, out);
    }

    // == Cleanup on ungraceful disconnect (tab closed, network drop) — ===
    // without this, closing the tab mid-call would leave a ghost
    // participant in the room forever, since /voice.leave is never sent.

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        if (sessionId == null) return;
        Long channelId = presence.leaveBySession(sessionId);
        if (channelId != null) broadcastRoster(channelId);
    }

    private void broadcastRoster(Long channelId) {
        List<VoiceChannelPresenceService.Participant> roster = presence.roster(channelId);
        Map<String, Object> msg = new HashMap<>();
        msg.put("_type", "VOICE_ROSTER");
        msg.put("channelId", channelId);
        msg.put("participants", roster);
        messaging.convertAndSend("/topic/channel/" + channelId, msg);
    }

    private static Long asLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        return Long.valueOf(o.toString());
    }
}
