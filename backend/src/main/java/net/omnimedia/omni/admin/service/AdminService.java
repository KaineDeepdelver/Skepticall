package net.omnimedia.omni.admin.service;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.admin.entity.Admin;
import net.omnimedia.omni.admin.repository.AdminRepository;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.friends.repository.FriendRequestRepository;
import net.omnimedia.omni.group.entity.GroupConversation;
import net.omnimedia.omni.group.repository.GroupConversationRepository;
import net.omnimedia.omni.group.repository.GroupMessageRepository;
import net.omnimedia.omni.message.repository.MessageRepository;
import net.omnimedia.omni.notification.repository.NotificationRepository;
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
    private final UserService userService;

    // == Cleanup dependencies — every table that holds a FK back to users ====
    private final FriendRequestRepository friendRequestRepo;
    private final MessageRepository messageRepo;
    private final NotificationRepository notificationRepo;
    private final GroupConversationRepository groupConversationRepo;
    private final GroupMessageRepository groupMessageRepo;

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

        // Social graph
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
