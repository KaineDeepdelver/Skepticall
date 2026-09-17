package net.omnimedia.omni.message.controller;

import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.group.dto.GroupMessageDTO;
import net.omnimedia.omni.group.service.GroupService;
import net.omnimedia.omni.notification.service.PushNotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

// Group calling reuses the existing pairwise CallWsController primitives
// (/call.offer, /call.answer, /call.ice — already generic, targetId-based,
// work for any pair of users regardless of DM vs group) for the actual
// WebRTC media negotiation. What's NEW here is just the roster layer: full
// mesh means every participant needs a direct peer connection to every
// OTHER participant, so this controller's only job is telling everyone in
// a group call who else is in it, so each client can independently decide
// who to open a call.offer to.
//
// Flow for a 3-person group call:
//   A calls  -> /call.group.invite  -> broadcasts to /topic/group/{id},
//               all group members' clients get a ring notification
//   B joins  -> /call.group.join    -> broadcasts to /topic/group-call/{id}.
//               A (already in the call) sees B joined and sends a
//               call.offer targeted at B. B answers. Mesh link A<->B forms.
//   C joins  -> /call.group.join    -> broadcasts. Both A and B now send a
//               call.offer targeted at C (two separate pairwise offers,
//               same as any 1:1 call) — C answers both. Mesh links
//               A<->C and B<->C form. Full mesh (A-B, A-C, B-C) complete.
//   Anyone leaves -> /call.group.leave -> broadcasts, remaining clients
//               tear down their pairwise connection to whoever left.
@Controller
public class GroupCallWsController {

    @Autowired private SimpMessagingTemplate messaging;
    @Autowired private GroupService groupService;
    @Autowired private PushNotificationService pushService;

    // In-memory roster per active group call. Small/simple by design —
    // this is presence bookkeeping for signaling only, not persisted
    // anywhere, and resets on server restart same as any WS session state.
    // groupId -> (userId -> participant info)
    private static final Map<Long, Map<Long, Map<String, Object>>> ROOMS = new ConcurrentHashMap<>();

    // Full mesh means every participant holds a direct connection to every
    // other one — cost grows fast (6 links at 4 people, 10 at 5, 15 at 6),
    // and on infra with no real media-server budget (no SFU), that's the
    // actual ceiling, not video quality. Capping at 4 keeps each person's
    // device to 3 simultaneous peer connections, which is the range mesh
    // stays reasonable at.
    private static final int MAX_ROOM_SIZE = 4;

    private Long uid(Principal principal) {
        if (principal == null) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Unauthenticated WebSocket session access attempted");
        }
        return Long.valueOf(principal.getName());
    }

    @MessageMapping("/call.group.invite")
    public void invite(Map<String, Object> payload, Principal principal) {
        Long groupId = Long.valueOf(payload.get("groupId").toString());
        Long from = uid(principal);
        String callType = (String) payload.getOrDefault("type", "audio");
        String callId = payload.containsKey("callId") ? payload.get("callId").toString() : ("gcall_" + System.currentTimeMillis());

        ROOMS.computeIfAbsent(groupId, g -> new ConcurrentHashMap<>());

        Map<String, Object> out = new HashMap<>();
        out.put("_type", "GROUP_CALL_INVITE");
        out.put("groupId", groupId);
        out.put("callId", callId);
        out.put("callType", callType);
        out.put("callerId", from);
        out.put("callerName", payload.getOrDefault("callerName", ""));
        out.put("callerAvatar", payload.getOrDefault("callerAvatar", ""));
        // Broadcast on the group's own message topic — every member is
        // already subscribed to this (same channel regular group messages
        // use), so no separate subscription is needed just to get rung.
        // The client's message handler explicitly ignores this ephemeral
        // signal (it's not a chat message) — it exists purely to trigger
        // the ringing UI for whoever isn't already in the call.
        messaging.convertAndSend("/topic/group/" + groupId, (Object) out);

        // Separately, persist an actual WhatsApp-style "X started a call"
        // row and broadcast THAT too, on the same topic — this one IS a
        // real chat message (real id/sender/createdAt), so it shows up in
        // history, survives a refresh, and is what renders the chat
        // bubble with the Join button.
        GroupMessageDTO logged = groupService.logCallStarted(groupId, from, callId, callType);
        messaging.convertAndSend("/topic/group/" + groupId, logged);

        // Ringing the group is exactly the "someone is calling" moment a
        // push notification exists for — everyone who isn't already
        // looking at the app needs to find out some way other than
        // opening it and happening to see the call-log row.
        var groupInfo = groupService.getGroup(groupId);
        if (groupInfo != null) {
            List<Long> memberIds = groupInfo.getMembers().stream().map(m -> m.getId()).toList();
            pushService.notifyGroupCall(from, groupId, groupInfo.getName(), memberIds, "video".equals(callType));
        }
    }

    // Lets a client check "is there already an active call room for this
    // group, and who's in it" WITHOUT joining — used to show a "N people
    // in call, tap to join" indicator on the conversation header for
    // someone who hasn't opened the room yet. Answer goes to the
    // requester's own personal topic only, same delivery channel
    // GROUP_CALL_ROSTER already uses.
    @MessageMapping("/call.group.peek")
    public void peek(Map<String, Object> payload, Principal principal) {
        Long groupId = Long.valueOf(payload.get("groupId").toString());
        Long self = uid(principal);
        Map<Long, Map<String, Object>> room = ROOMS.get(groupId);

        Map<String, Object> out = new HashMap<>();
        out.put("_type", "GROUP_CALL_PEEK_RESULT");
        out.put("groupId", groupId);
        out.put("participants", room != null ? new ArrayList<>(room.values()) : new ArrayList<>());
        messaging.convertAndSend("/topic/messages/" + self, (Object) out);
    }

    // Adding someone to an existing DM call ("upgrade to group") reuses
    // this exact same room infrastructure (ROOMS/join/leave/peek all just
    // key off a Long id — doesn't care whether it's a real group or a
    // synthetic ad-hoc room id generated client-side), but there's no real
    // group to broadcast the invite to, so this sends it directly to one
    // specific person's personal topic instead of /topic/group/{id}.
    @MessageMapping("/call.adhoc.invite")
    public void adhocInvite(Map<String, Object> payload, Principal principal) {
        Long targetId = Long.valueOf(payload.get("targetId").toString());
        Long roomId = Long.valueOf(payload.get("roomId").toString());
        Long from = uid(principal);
        String callType = (String) payload.getOrDefault("type", "audio");
        String callId = payload.containsKey("callId") ? payload.get("callId").toString() : ("adhoc_" + System.currentTimeMillis());

        ROOMS.computeIfAbsent(roomId, g -> new ConcurrentHashMap<>());

        Map<String, Object> out = new HashMap<>();
        out.put("_type", "GROUP_CALL_INVITE");
        out.put("groupId", roomId);
        out.put("adhoc", true);
        out.put("callId", callId);
        out.put("callType", callType);
        out.put("callerId", from);
        out.put("callerName", payload.getOrDefault("callerName", ""));
        out.put("callerAvatar", payload.getOrDefault("callerAvatar", ""));
        messaging.convertAndSend("/topic/messages/" + targetId, (Object) out);
    }

    @MessageMapping("/call.group.join")
    public void join(Map<String, Object> payload, Principal principal) {
        Long groupId = Long.valueOf(payload.get("groupId").toString());
        Long self = uid(principal);
        String callId = (String) payload.get("callId");

        Map<Long, Map<String, Object>> room = ROOMS.computeIfAbsent(groupId, g -> new ConcurrentHashMap<>());

        // Reject in the room boundary, not per-client — this is the one
        // place every join path (group calls, ad-hoc DM-upgrade calls)
        // funnels through, so it's the only enforcement point that
        // actually matters. Already-in-room rejoin (reconnect) is allowed
        // through even at capacity, since they're not growing the room.
        if (!room.containsKey(self) && room.size() >= MAX_ROOM_SIZE) {
            Map<String, Object> full = new HashMap<>();
            full.put("_type", "GROUP_CALL_ROOM_FULL");
            full.put("groupId", groupId);
            full.put("callId", callId);
            full.put("maxSize", MAX_ROOM_SIZE);
            messaging.convertAndSend("/topic/messages/" + self, (Object) full);
            return;
        }

        Map<String, Object> me = new HashMap<>();
        me.put("userId", self);
        me.put("name", payload.getOrDefault("name", ""));
        me.put("avatar", payload.getOrDefault("avatar", ""));
        room.put(self, me);

        // Send the CURRENT roster back to just the joiner (so they know who
        // to expect offers from / who's already there), then tell everyone
        // else a new participant arrived (so THEY send an offer to the
        // joiner — mesh links are always initiated by the existing
        // participant toward the newcomer, never the other way, to avoid
        // both sides racing to send simultaneous offers to each other).
        Map<String, Object> roster = new HashMap<>();
        roster.put("_type", "GROUP_CALL_ROSTER");
        roster.put("groupId", groupId);
        roster.put("callId", callId);
        roster.put("participants", new ArrayList<>(room.values()));
        messaging.convertAndSend("/topic/messages/" + self, (Object) roster);

        Map<String, Object> joined = new HashMap<>();
        joined.put("_type", "GROUP_CALL_JOIN");
        joined.put("groupId", groupId);
        joined.put("callId", callId);
        joined.put("userId", self);
        joined.put("name", payload.getOrDefault("name", ""));
        joined.put("avatar", payload.getOrDefault("avatar", ""));
        messaging.convertAndSend("/topic/group-call/" + groupId, (Object) joined);
    }

    @MessageMapping("/call.group.leave")
    public void leave(Map<String, Object> payload, Principal principal) {
        Long groupId = Long.valueOf(payload.get("groupId").toString());
        Long self = uid(principal);
        String callId = (String) payload.get("callId");

        Map<Long, Map<String, Object>> room = ROOMS.get(groupId);
        boolean roomEmptiedOut = false;
        if (room != null) {
            room.remove(self);
            if (room.isEmpty()) { ROOMS.remove(groupId); roomEmptiedOut = true; }
        }
        // Last person out with no explicit /call.group.end (people just
        // trickled out one by one) — same call-log cleanup as end(), so
        // the chat bubble doesn't sit there claiming the call is still
        // ongoing forever.
        if (roomEmptiedOut) {
            GroupMessageDTO logged = groupService.logCallEnded(groupId, callId);
            if (logged != null) messaging.convertAndSend("/topic/group/" + groupId, logged);
        }

        Map<String, Object> out = new HashMap<>();
        out.put("_type", "GROUP_CALL_LEAVE");
        out.put("groupId", groupId);
        out.put("callId", callId);
        out.put("userId", self);
        messaging.convertAndSend("/topic/group-call/" + groupId, (Object) out);
    }

    // Explicit "end the whole call for everyone" — distinct from leave
    // (one person dropping out). Any participant can end it; typically
    // the UI only exposes this when the room would otherwise become empty,
    // but that's a client-side policy choice, not enforced here.
    @MessageMapping("/call.group.end")
    public void end(Map<String, Object> payload, Principal principal) {
        Long groupId = Long.valueOf(payload.get("groupId").toString());
        String callId = (String) payload.get("callId");
        ROOMS.remove(groupId);

        Map<String, Object> out = new HashMap<>();
        out.put("_type", "GROUP_CALL_END");
        out.put("groupId", groupId);
        out.put("callId", callId);
        // Only the live in-call clients need this one, to tear down their
        // peer connections — it's not a chat message, so it no longer
        // also goes to /topic/group/{id} (that used to leak into the
        // message list as a blank bubble).
        messaging.convertAndSend("/topic/group-call/" + groupId, (Object) out);

        // Flip the matching call-log row (if any — a call that was never
        // rung has nothing logged) to ENDED and broadcast the update on
        // the chat topic so the bubble drops its Join button.
        GroupMessageDTO logged = groupService.logCallEnded(groupId, callId);
        if (logged != null) {
            messaging.convertAndSend("/topic/group/" + groupId, logged);
        }
    }
}
