package net.omnimedia.omni.group.service;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.group.dto.GroupDTO;
import net.omnimedia.omni.group.dto.GroupMessageDTO;
import net.omnimedia.omni.group.dto.MemberDTO;
import net.omnimedia.omni.group.entity.GroupConversation;
import net.omnimedia.omni.group.entity.GroupMessage;
import net.omnimedia.omni.group.repository.GroupConversationRepository;
import net.omnimedia.omni.group.repository.GroupMessageRepository;
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
    private final UserRepository userRepository;

    @Transactional
    public GroupDTO createGroup(Long creatorId, String name, List<Long> memberIds) {
        User creator = userRepository.findById(creatorId).orElseThrow();
        List<User> members = new ArrayList<>();
        members.add(creator);
        memberIds.stream()
                .filter(id -> !id.equals(creatorId))
                .map(id -> userRepository.findById(id).orElse(null))
                .filter(Objects::nonNull)
                .forEach(members::add);
        GroupConversation g = GroupConversation.builder().name(name).creator(creator).members(members).build();
        return toDTO(groupConversationRepository.save(g));
    }

    public List<GroupDTO> getGroupsForUser(Long userId) {
        return groupConversationRepository.findByMemberId(userId).stream().map(this::toDTO).toList();
    }

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
                .forEach(u -> g.getMembers().add(u));

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
                .build();

        return toMsgDTO(groupMessageRepository.save(msg));
    }


    public List<GroupMessageDTO> getMessages(Long groupId) {
        return groupMessageRepository.findByGroupIdOrderByCreatedAtAsc(groupId).stream().map(this::toMsgDTO).toList();
    }

    private GroupDTO toDTO(GroupConversation g) {
        List<MemberDTO> memberDTOs = g.getMembers().stream().map(user ->
                MemberDTO.builder()
                        .id(user.getId())
                        .username(user.getUsername())
                        .displayName(user.getDisplayName())
                        .avatar(user.getProfilePicture())
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
        return toMsgDTO(groupMessageRepository.save(msg));
    }


    public GroupMessageDTO toMsgDTO(GroupMessage groupMessage) {
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
                .build();
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