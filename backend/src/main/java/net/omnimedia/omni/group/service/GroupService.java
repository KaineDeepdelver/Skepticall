package net.omnimedia.omni.group.service;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.group.dto.GroupDTO;
import net.omnimedia.omni.group.dto.GroupMessageDTO;
import net.omnimedia.omni.group.dto.GroupMessageKeyDTO;
import net.omnimedia.omni.group.dto.MemberDTO;
import net.omnimedia.omni.group.entity.GroupConversation;
import net.omnimedia.omni.group.entity.GroupMessage;
import net.omnimedia.omni.group.entity.GroupMessageKey;
import net.omnimedia.omni.group.repository.GroupConversationRepository;
import net.omnimedia.omni.group.repository.GroupMessageRepository;
import net.omnimedia.omni.group.repository.GroupMessageKeyRepository;
import net.omnimedia.omni.user.entity.User;
import net.omnimedia.omni.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupService {
    private final GroupConversationRepository groupConversationRepository;
    private final GroupMessageRepository groupMessageRepository;
    private final GroupMessageKeyRepository groupMessageKeyRepository;
    private final UserRepository userRepository;
    private final net.omnimedia.omni.friends.repository.FriendRequestRepository friendRepo;

    // Settings > Privacy > Group invites from anyone (off = only friends can add them)
    private void requireInvitable(Long inviterId, User u) {
        if (!Boolean.FALSE.equals(u.getGroupInvitesAnyone())) return;
        boolean friends = friendRepo.findBetween(inviterId, u.getId())
                .map(r -> "ACCEPTED".equals(r.getStatus())).orElse(false);
        if (!friends) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "@" + u.getUsername() + " only accepts group invites from friends");
        }
    }

    @Transactional
    public GroupDTO createGroup(Long creatorId, String name, List<Long> memberIds) {
        User creator = userRepository.findById(creatorId).orElseThrow();
        List<User> members = new ArrayList<>();
        members.add(creator);
        memberIds.stream()
                .filter(id -> !id.equals(creatorId))
                .map(id -> userRepository.findById(id).orElse(null))
                .filter(Objects::nonNull)
                .forEach(u -> { requireInvitable(creatorId, u); members.add(u); });
        GroupConversation g = GroupConversation.builder().name(name).creator(creator).members(members).build();
        return toDTO(groupConversationRepository.save(g));
    }

    public List<GroupDTO> getGroupsForUser(Long userId) {
        return groupConversationRepository.findByMemberId(userId).stream().map(this::toDTO).toList();
    }

    // @Transactional here isn't just tidiness — GET /groups/{id} gets away
    // without it because Spring Boot's Open-Session-In-View keeps a
    // Hibernate session open for the whole HTTP request, but the
    // GroupWsController/GroupCallWsController call this same method from
    // STOMP @MessageMapping handlers, which have no such request-scoped
    // session. Without an explicit transaction here, toDTO()'s lazy
    // g.getMembers() access blows up with LazyInitializationException the
    // moment it's called from a WS handler instead of an HTTP one.
    @Transactional(readOnly = true)
    public GroupDTO getGroup(Long id) {
        return toDTO(groupConversationRepository.findById(id).orElseThrow());
    }

    @Transactional
    public GroupDTO renameGroup(Long groupId, Long requesterId, String newName) {
        GroupConversation g = groupConversationRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Group not found [groupId=" + groupId + "]"));

        if (!g.getCreator().getId().equals(requesterId)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Only the group admin can rename this group");
        }

        g.setName(newName.trim());
        return toDTO(groupConversationRepository.save(g));
    }


    @Transactional
    public GroupDTO addMembers(Long groupId, Long requesterId, List<Long> newMemberIds) {
        GroupConversation g = groupConversationRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Group not found [groupId=" + groupId + "]"));

        boolean isCreator = g.getCreator().getId().equals(requesterId);
        if (!isCreator && !Boolean.TRUE.equals(g.getPermAddMembers())) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Only admins can add members to this group");
        }

        Set<Long> existing = g.getMembers().stream().map(User::getId).collect(Collectors.toSet());
        newMemberIds.stream()
                .filter(id -> !existing.contains(id))
                .map(id -> userRepository.findById(id).orElse(null))
                .filter(Objects::nonNull)
                .forEach(u -> { requireInvitable(requesterId, u); g.getMembers().add(u); });

        return toDTO(groupConversationRepository.save(g));
    }


    @Transactional
    public GroupDTO removeMember(Long groupId, Long requesterId, Long memberId) {
        GroupConversation g = groupConversationRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Group not found [groupId=" + groupId + "]"));

        if (!g.getCreator().getId().equals(requesterId)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Only group admin can remove members");
        }

        g.getMembers().removeIf(u -> u.getId().equals(memberId));
        return toDTO(groupConversationRepository.save(g));
    }


    @Transactional
    public void leaveGroup(Long groupId, Long userId) {
        GroupConversation g = groupConversationRepository.findById(groupId).orElseThrow();
        g.getMembers().removeIf(u -> u.getId().equals(userId));
        groupConversationRepository.save(g);
    }

    @Transactional
    public GroupMessageDTO sendMessage(Long groupId, Long senderId, String content, String type, String fileUrl) {
        return sendMessage(groupId, senderId, content, type, fileUrl, null, null, null, null, null, null, null);
    }

    @Transactional
    public GroupMessageDTO sendMessage(Long groupId, Long senderId, String content, String type, String fileUrl,
                                        Long replyToId, String replyPreview, String replyPreviewSender) {
        return sendMessage(groupId, senderId, content, type, fileUrl, replyToId, replyPreview, replyPreviewSender,
                null, null, null, null);
    }

    // Full version — E2E-aware. nonce/replyPreviewNonce/mediaNonce are
    // null for a plaintext send (legacy path, or a markup/trim send that
    // needs the server to read real media bytes — same necessary
    // exception as 1:1). recipientKeys is the client-generated per-member
    // key fan-out — see GroupMessageKey. The server never generates or
    // sees any actual key material, only ever stores what the client
    // (which alone holds the private keys involved) already encrypted.
    @Transactional
    public GroupMessageDTO sendMessage(Long groupId, Long senderId, String content, String type, String fileUrl,
                                        Long replyToId, String replyPreview, String replyPreviewSender,
                                        String nonce, String replyPreviewNonce, String mediaNonce,
                                        List<GroupMessageKeyDTO> recipientKeys) {
        GroupConversation groupConversation = groupConversationRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Group conversation not found [groupId=" + groupId + "]"));

        boolean isCreator = groupConversation.getCreator().getId().equals(senderId);
        if (!isCreator && !Boolean.TRUE.equals(groupConversation.getPermSendMessages())) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Only admins can send messages in this group");
        }

        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Sender user profile not found [senderId=" + senderId + "]"));

        GroupMessage msg = GroupMessage.builder()
                .group(groupConversation)
                .sender(sender)
                .content(content)
                .type(type != null ? type : "TEXT")
                .fileUrl(fileUrl)
                .status("SENT")
                .replyToId(replyToId)
                .replyPreview(replyPreview)
                .replyPreviewSender(replyPreviewSender)
                .nonce(nonce)
                .replyPreviewNonce(replyPreviewNonce)
                .mediaNonce(mediaNonce)
                .build();

        GroupMessage saved = groupMessageRepository.save(msg);
        saveRecipientKeys(saved, recipientKeys);
        return toMsgDTO(saved, recipientKeys);
    }

    // Saves the client-provided per-member wrapped keys against the
    // now-persisted message id. A no-op (not an error) when recipientKeys
    // is empty/null — that's just a plaintext send.
    private void saveRecipientKeys(GroupMessage saved, List<GroupMessageKeyDTO> recipientKeys) {
        if (recipientKeys == null || recipientKeys.isEmpty()) return;
        List<GroupMessageKey> rows = recipientKeys.stream().map(k -> GroupMessageKey.builder()
                .groupMessage(saved)
                .recipient(userRepository.getReferenceById(k.getRecipientId()))
                .keyType(k.getKeyType())
                .wrappedKey(k.getWrappedKey())
                .wrappedKeyNonce(k.getWrappedKeyNonce())
                .build()).toList();
        groupMessageKeyRepository.saveAll(rows);
    }

    @Transactional
    public GroupMessageDTO editMessage(Long messageId, Long requesterId, String content) {
        return editMessage(messageId, requesterId, content, null, null);
    }

    // A new ciphertext needs a fresh nonce and a freshly re-wrapped key
    // set every time — same reasoning as 1:1 edits (MessageService):
    // reusing a nonce with new ciphertext breaks crypto_box/secretbox's
    // security guarantees, so the old GroupMessageKey rows for this
    // message are replaced wholesale, not patched.
    @Transactional
    public GroupMessageDTO editMessage(Long messageId, Long requesterId, String content, String nonce,
                                        List<GroupMessageKeyDTO> recipientKeys) {
        GroupMessage msg = groupMessageRepository.findById(messageId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Group message not found [messageId=" + messageId + "]"));

        if (!msg.getSender().getId().equals(requesterId)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Not your message to edit");
        }
        if ("DELETE".equals(msg.getType())) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Can't edit a deleted message");
        }

        msg.setContent(content);
        msg.setNonce(nonce);
        msg.setEdited(true);
        GroupMessage saved = groupMessageRepository.save(msg);
        if (nonce != null) {
            groupMessageKeyRepository.deleteByGroupMessageId(messageId);
            saveRecipientKeys(saved, recipientKeys);
        }
        return toMsgDTO(saved, recipientKeys);
    }



    public List<GroupMessageDTO> getMessages(Long groupId) {
        List<GroupMessage> rows = groupMessageRepository.findByGroupIdOrderByCreatedAtAsc(groupId);
        if (rows.isEmpty()) return List.of();
        // One batched key fetch for the whole history instead of N+1,
        // then grouped back onto their parent message by id.
        List<Long> ids = rows.stream().map(GroupMessage::getId).toList();
        Map<Long, List<GroupMessageKeyDTO>> keysByMessageId = new HashMap<>();
        for (GroupMessageKey k : groupMessageKeyRepository.findByGroupMessageIdIn(ids)) {
            keysByMessageId.computeIfAbsent(k.getGroupMessage().getId(), x -> new ArrayList<>()).add(toKeyDTO(k));
        }
        return rows.stream().map(m -> toMsgDTO(m, keysByMessageId.get(m.getId()))).toList();
    }

    private GroupDTO toDTO(GroupConversation g) {
        List<MemberDTO> memberDTOs = g.getMembers().stream().map(user ->
                MemberDTO.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .displayName(user.getDisplayName())
                        .avatar(user.getProfilePicture())
                        .publicKey(user.getPublicKey())
                        .build()
        ).collect(Collectors.toList());

        return GroupDTO.builder()
                .id(g.getId())
                .name(g.getName())
                .avatarUrl(g.getAvatarUrl())
                .creatorId(g.getCreator().getId())
                .members(memberDTOs)
                .memberCount(memberDTOs.size())
                .permEditSettings(Boolean.TRUE.equals(g.getPermEditSettings()))
                .permSendMessages(Boolean.TRUE.equals(g.getPermSendMessages()))
                .permAddMembers(Boolean.TRUE.equals(g.getPermAddMembers()))
                .build();
    }

    @Transactional
    public GroupMessageDTO deleteGroupMessage(Long messageId, Long requesterId) {
        GroupMessage msg = groupMessageRepository.findById(messageId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Group message not found [messageId=" + messageId + "]"));

        if (!msg.getSender().getId().equals(requesterId)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Only the sender can delete their message");
        }

        msg.setType("DELETE");
        msg.setContent(null);
        msg.setFileUrl(null);
        msg.setNonce(null);
        msg.setReplyPreviewNonce(null);
        msg.setMediaNonce(null);
        GroupMessage saved = groupMessageRepository.save(msg);
        groupMessageKeyRepository.deleteByGroupMessageId(messageId);
        return toMsgDTO(saved, null);
    }

    public GroupMessageDTO toMsgDTO(GroupMessage groupMessage) {
        return toMsgDTO(groupMessage, groupMessageKeyRepository.findByGroupMessageId(groupMessage.getId())
                .stream().map(GroupService::toKeyDTO).toList());
    }

    // recipientKeys is passed in rather than always queried fresh — the
    // hot paths (send/edit) already have it in hand from the client's
    // own request and would otherwise trigger a redundant extra query
    // immediately after the save that just wrote those exact rows.
    public GroupMessageDTO toMsgDTO(GroupMessage groupMessage, List<GroupMessageKeyDTO> recipientKeys) {
        User sender = groupMessage.getSender();
        return GroupMessageDTO.builder()
                .id(groupMessage.getId())
                .groupId(groupMessage.getGroup().getId())
                .senderId(sender.getId())
                .senderUsername(sender.getUsername())
                .senderDisplayName(sender.getDisplayName())
                .senderAvatar(sender.getProfilePicture())
                .content(groupMessage.getContent())
                .type(groupMessage.getType())
                .fileUrl(groupMessage.getFileUrl())
                .edited(groupMessage.getEdited())
                .status(groupMessage.getStatus())
                .createdAt(groupMessage.getCreatedAt())
                .replyToId(groupMessage.getReplyToId())
                .replyPreview(groupMessage.getReplyPreview())
                .replyPreviewSender(groupMessage.getReplyPreviewSender())
                .callId(groupMessage.getCallId())
                .callStatus(groupMessage.getCallStatus())
                .nonce(groupMessage.getNonce())
                .replyPreviewNonce(groupMessage.getReplyPreviewNonce())
                .mediaNonce(groupMessage.getMediaNonce())
                .recipientKeys(recipientKeys)
                .build();
    }

    private static GroupMessageKeyDTO toKeyDTO(GroupMessageKey k) {
        return GroupMessageKeyDTO.builder()
                .recipientId(k.getRecipient().getId())
                .keyType(k.getKeyType())
                .wrappedKey(k.getWrappedKey())
                .wrappedKeyNonce(k.getWrappedKeyNonce())
                .build();
    }

    // == Call log (WhatsApp-style "X started a call" chat entry) ==
    // Called from GroupCallWsController's /call.group.invite handler —
    // ringing the group is the moment a call becomes something worth
    // showing in history, since starting/joining a room is otherwise
    // silent by design (see that controller's top comment).
    @Transactional
    public GroupMessageDTO logCallStarted(Long groupId, Long callerId, String callId, String callType) {
        GroupConversation groupConversation = groupConversationRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Group conversation not found [groupId=" + groupId + "]"));
        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Caller user profile not found [callerId=" + callerId + "]"));

        GroupMessage msg = GroupMessage.builder()
                .group(groupConversation)
                .sender(caller)
                .type("CALL")
                .content(callType != null ? callType : "audio")
                .status("SENT")
                .callId(callId)
                .callStatus("ONGOING")
                .build();

        return toMsgDTO(groupMessageRepository.save(msg));
    }

    // Flips the matching call-log row to ENDED so the chat bubble drops
    // its "Join" button and shows "Call ended" instead. Returns null (no
    // broadcast, nothing to update) if no log row exists for this
    // callId — e.g. the call was never rung, so there was nothing to log.
    @Transactional
    public GroupMessageDTO logCallEnded(Long groupId, String callId) {
        if (callId == null) return null;
        GroupMessage msg = groupMessageRepository
                .findFirstByGroupIdAndCallIdOrderByIdDesc(groupId, callId)
                .orElse(null);
        if (msg == null) return null;

        msg.setCallStatus("ENDED");
        return toMsgDTO(groupMessageRepository.save(msg));
    }

    @Transactional
    public GroupDTO updatePermissions(Long groupId, Long requesterId,
                                      Boolean permEditSettings,
                                      Boolean permSendMessages,
                                      Boolean permAddMembers) {
        GroupConversation g = groupConversationRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Group conversation not found [groupId=" + groupId + "]"));

        if (!g.getCreator().getId().equals(requesterId)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Only the group admin can change permissions");
        }

        if (permEditSettings != null) g.setPermEditSettings(permEditSettings);
        if (permSendMessages != null) g.setPermSendMessages(permSendMessages);
        if (permAddMembers   != null) g.setPermAddMembers(permAddMembers);
        return toDTO(groupConversationRepository.save(g));
    }

}