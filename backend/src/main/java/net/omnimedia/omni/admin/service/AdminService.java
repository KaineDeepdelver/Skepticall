package net.omnimedia.omni.admin.service;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.admin.entity.Admin;
import net.omnimedia.omni.admin.repository.AdminRepository;
import net.omnimedia.omni.comment.repository.CommentReactionRepository;
import net.omnimedia.omni.comment.repository.CommentRepository;
import net.omnimedia.omni.comment.repository.CommentVoteRepository;
import net.omnimedia.omni.comment.service.CommentService;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.follow.repository.FollowRepository;
import net.omnimedia.omni.friends.repository.FriendRequestRepository;
import net.omnimedia.omni.group.entity.GroupConversation;
import net.omnimedia.omni.group.repository.GroupConversationRepository;
import net.omnimedia.omni.group.repository.GroupMessageRepository;
import net.omnimedia.omni.media.repository.MediaItemRepository;
import net.omnimedia.omni.media.repository.MediaVoteRepository;
import net.omnimedia.omni.media.service.MediaService;
import net.omnimedia.omni.message.repository.MessageRepository;
import net.omnimedia.omni.network.entity.Network;
import net.omnimedia.omni.network.entity.NetworkMember;
import net.omnimedia.omni.network.repository.ChannelMessageRepository;
import net.omnimedia.omni.network.repository.NetworkMemberRepository;
import net.omnimedia.omni.network.repository.NetworkRepository;
import net.omnimedia.omni.notification.repository.NotificationRepository;
import net.omnimedia.omni.post.repository.PostRepository;
import net.omnimedia.omni.post.repository.PostVoteRepository;
import net.omnimedia.omni.post.service.PostService;
import net.omnimedia.omni.user.dto.UserDTO;
import net.omnimedia.omni.user.entity.User;
import net.omnimedia.omni.user.repository.UserRepository;
import net.omnimedia.omni.user.service.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final AdminRepository adminRepo;
    private final UserRepository userRepo;
    private final PostService postService;
    private final CommentService commentService;
    private final MediaService mediaService;
    private final UserService userService;

    // == Cleanup dependencies — every table that holds a FK back to users ====
    private final PostRepository postRepo;
    private final PostVoteRepository postVoteRepo;
    private final CommentRepository commentRepo;
    private final CommentVoteRepository commentVoteRepo;
    private final CommentReactionRepository commentReactionRepo;
    private final MediaItemRepository mediaItemRepo;
    private final MediaVoteRepository mediaVoteRepo;
    private final FollowRepository followRepo;
    private final FriendRequestRepository friendRequestRepo;
    private final MessageRepository messageRepo;
    private final NotificationRepository notificationRepo;
    private final GroupConversationRepository groupConversationRepo;
    private final GroupMessageRepository groupMessageRepo;
    private final NetworkRepository networkRepo;
    private final NetworkMemberRepository networkMemberRepo;
    private final ChannelMessageRepository channelMessageRepo;

    // == Access check =========================================================

    /** Throws if the given user is not an admin. Call this at the top of every admin action. */
    public void requireAdmin(Long actingUserId) {
        if (actingUserId == null || !adminRepo.existsByUserId(actingUserId)) {
            throw new BusinessException(
                    ErrorType.PERMISSION_DENIED,
                    "Admin access required [actingUserId=" + actingUserId + "]"
            );
        }
    }


    public boolean isAdmin(Long userId) {
        return userId != null && adminRepo.existsByUserId(userId);
    }

    // == Moderation deletes — all bypass normal ownership checks =============

    @Transactional
    public void deletePost(Long actingAdminId, Long postId) {
        requireAdmin(actingAdminId);
        postService.adminDelete(postId);
    }

    @Transactional
    public void deleteComment(Long actingAdminId, Long commentId) {
        requireAdmin(actingAdminId);
        commentService.adminDelete(commentId);
    }

    @Transactional
    public void deleteMedia(Long actingAdminId, Long mediaId) {
        requireAdmin(actingAdminId);
        mediaService.adminDelete(mediaId);
    }

    @Transactional
    public void deleteUser(Long actingAdminId, Long targetUserId) {
        requireAdmin(actingAdminId);

        if (actingAdminId.equals(targetUserId)) {
            throw new BusinessException(
                    ErrorType.INVALID_OPERATION,
                    "Admins cannot delete their own account from the admin panel — use account settings instead"
            );
        }

        // Fail fast if the target doesn't exist, before doing any cleanup work below
        if (!userRepo.existsById(targetUserId)) {
            throw new BusinessException(
                    ErrorType.NOT_FOUND,
                    "User profile not found [targetUserId=" + targetUserId + "]"
            );
        }

        // Clear every vote/reaction this user cast on ANYONE's content first — including content
        // we're about to delete below, whose own adminDelete() also clears votes cast by OTHER
        // users on it. Together these two layers cover every combination.
        postVoteRepo.deleteAllByUserId(targetUserId);
        commentVoteRepo.deleteAllByUserId(targetUserId);
        commentReactionRepo.deleteAllByUserId(targetUserId);
        mediaVoteRepo.deleteAllByUserId(targetUserId);

        // Comments this user wrote (on anyone's post/media) — adminDelete also cleans up replies,
        // so a reply in this list may already be gone by the time we reach it; that's expected.
        commentRepo.findByAuthorId(targetUserId).forEach(c -> {
            if (commentRepo.existsById(c.getId())) commentService.adminDelete(c.getId());
        });

        // Posts and media this user authored — adminDelete also cleans up attached PostMedia rows.
        postRepo.findByAuthorId(targetUserId)
                .forEach(p -> postService.adminDelete(p.getId()));
        mediaItemRepo.findByAuthorIdOrderByCreatedAtDesc(targetUserId)
                .forEach(m -> mediaService.adminDelete(m.getId()));

        // Social graph
        followRepo.deleteAllForUser(targetUserId);
        friendRequestRepo.deleteAllForUser(targetUserId);

        // Direct messages and notifications, both directions
        messageRepo.deleteAllForUser(targetUserId);
        notificationRepo.deleteAllForUser(targetUserId);

        // Group chat — remove this user's messages, then resolve membership/ownership
        groupMessageRepo.deleteAllBySenderId(targetUserId);
        for (GroupConversation g : groupConversationRepo.findByMemberId(targetUserId)) {
            g.getMembers().removeIf(m -> m.getId().equals(targetUserId));
            // If they were the creator, hand ownership to the next remaining member.
            if (g.getCreator() != null && g.getCreator().getId().equals(targetUserId)) {
                if (g.getMembers().isEmpty()) {
                    groupConversationRepo.delete(g); // no one left — the group is orphaned, remove it
                    continue;
                }
                g.setCreator(g.getMembers().get(0));
            }
            groupConversationRepo.save(g);
        }

        // Networks — remove this user's channel messages, then resolve membership/ownership.
        // Same shape as the group-chat cleanup above: if they owned a network, hand ownership
        // to whoever's left, or delete the network if it's now empty.
        channelMessageRepo.deleteAllByAuthorId(targetUserId);
        for (NetworkMember nm : networkMemberRepo.findByUserId(targetUserId)) {
            Network network = nm.getNetwork();
            boolean wasOwner = network.getOwner().getId().equals(targetUserId);
            networkMemberRepo.delete(nm);
            if (wasOwner) {
                List<NetworkMember> remaining = networkMemberRepo.findByNetworkId(network.getId());
                if (remaining.isEmpty()) {
                    networkRepo.delete(network); // no one left — orphaned, remove it
                } else {
                    network.setOwner(remaining.get(0).getUser());
                    networkRepo.save(network);
                }
            }
        }

        // Admin row, if this user happened to be an admin being removed
        adminRepo.findByUserId(targetUserId).ifPresent(adminRepo::delete);

        // Finally, the account itself
        userService.adminDeleteAccount(targetUserId);
    }

    // == Admin roster management ==============================================

    public List<UserDTO> listAdmins(Long actingAdminId) {
        requireAdmin(actingAdminId);
        return adminRepo.findAll().stream()
                .map(a -> userService.getUser(a.getUser().getId()))
                .toList();
    }

    @Transactional
    public void grantAdmin(Long actingAdminId, Long targetUserId) {
        requireAdmin(actingAdminId);
        if (adminRepo.existsByUserId(targetUserId)) return; // already an admin, no-op

        User target = userRepo.findById(targetUserId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "User profile not found [targetUserId=" + targetUserId + "]"));

        adminRepo.save(Admin.builder().user(target).build());
    }

    @Transactional
    public void revokeAdmin(Long actingAdminId, Long targetUserId) {
        requireAdmin(actingAdminId);
        Admin admin = adminRepo.findByUserId(targetUserId)
                .orElseThrow(() -> new BusinessException(ErrorType.INVALID_OPERATION, "User is not an admin [targetUserId=" + targetUserId + "]"));

        adminRepo.delete(admin);
    }


    // == User listing for the admin panel =====================================

    public List<UserDTO> listAllUsers(Long actingAdminId) {
        requireAdmin(actingAdminId);
        return userRepo.findAll().stream()
                .map(u -> userService.getUser(u.getId()))
                .toList();
    }
}
