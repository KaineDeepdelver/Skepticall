package net.omnimedia.omni.network.service;

import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks who is currently sitting in each network's VOICE-type channels.
 * This is deliberately in-memory only — voice-channel presence is a live
 * session concept, not something that belongs in the database (nobody
 * wants "who was in the voice channel" showing up in a migration).
 * <p>
 * A user is assumed to occupy at most one voice channel at a time — joining
 * a new one implicitly leaves whichever one they were already in, the same
 * behavior Discord-style voice channels have.
 */
@Service
public class VoiceChannelPresenceService {

    public record Participant(Long userId, String name, String avatarUrl, boolean muted) {
        Participant withMuted(boolean m) { return new Participant(userId, name, avatarUrl, m); }
    }

    // channelId -> (userId -> participant)
    private final Map<Long, Map<Long, Participant>> rooms = new ConcurrentHashMap<>();
    // userId -> channelId currently occupied, so join() can evict a stale seat
    // and so a STOMP disconnect (keyed by session, see bySession) can find the
    // right room to clean up.
    private final Map<Long, Long> currentChannelByUser = new ConcurrentHashMap<>();
    // STOMP sessionId -> userId, populated on join, consulted on disconnect —
    // this is what lets an ungraceful disconnect (tab closed, network drop)
    // still get cleaned up instead of leaving a ghost participant forever.
    private final Map<String, Long> userBySession = new ConcurrentHashMap<>();

    /** Returns the channelId the user was previously in, if any (so the caller can broadcast their departure from it), plus adds them to the new room. */
    public synchronized Long join(Long channelId, Long userId, String name, String avatarUrl, String sessionId) {
        Long previousChannelId = currentChannelByUser.get(userId);
        if (previousChannelId != null && !previousChannelId.equals(channelId)) {
            removeFromRoom(previousChannelId, userId);
        }
        rooms.computeIfAbsent(channelId, k -> new ConcurrentHashMap<>())
                .put(userId, new Participant(userId, name, avatarUrl, false));
        currentChannelByUser.put(userId, channelId);
        if (sessionId != null) userBySession.put(sessionId, userId);
        return previousChannelId != null && !previousChannelId.equals(channelId) ? previousChannelId : null;
    }

    public synchronized void leave(Long channelId, Long userId) {
        removeFromRoom(channelId, userId);
    }

    /** Called from the STOMP disconnect listener. Returns the channelId to broadcast a departure for, or null if the session wasn't in a voice room. */
    public synchronized Long leaveBySession(String sessionId) {
        Long userId = userBySession.remove(sessionId);
        if (userId == null) return null;
        Long channelId = currentChannelByUser.get(userId);
        if (channelId == null) return null;
        removeFromRoom(channelId, userId);
        return channelId;
    }

    public synchronized void setMuted(Long channelId, Long userId, boolean muted) {
        Map<Long, Participant> room = rooms.get(channelId);
        if (room == null) return;
        room.computeIfPresent(userId, (id, p) -> p.withMuted(muted));
    }

    public List<Participant> roster(Long channelId) {
        Map<Long, Participant> room = rooms.get(channelId);
        if (room == null) return List.of();
        Collection<Participant> values = room.values();
        return List.copyOf(values);
    }

    private void removeFromRoom(Long channelId, Long userId) {
        Map<Long, Participant> room = rooms.get(channelId);
        if (room != null) {
            room.remove(userId);
            if (room.isEmpty()) rooms.remove(channelId);
        }
        currentChannelByUser.remove(userId, channelId);
    }
}
