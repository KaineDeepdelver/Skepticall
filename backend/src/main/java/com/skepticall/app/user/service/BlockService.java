package com.skepticall.app.user.service;

import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.exceptions.ErrorType;
import com.skepticall.app.friends.repository.FriendRequestRepository;
import com.skepticall.app.user.dto.BlockedUserDTO;
import com.skepticall.app.user.entity.User;
import com.skepticall.app.user.entity.UserBlock;
import com.skepticall.app.user.repository.UserBlockRepository;
import com.skepticall.app.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Blocking. The other person is never told they were blocked: the places that enforce it (direct
 * messages, calls, friend requests) answer in a way that does not reveal it.
 */
@Service
@RequiredArgsConstructor
public class BlockService {

    private final UserBlockRepository blockRepository;
    private final UserRepository userRepository;
    private final FriendRequestRepository friendRequestRepository;

    /** Blocks {@code targetId}. Blocking someone twice is fine. Any friendship or pending request is removed. */
    @Transactional
    public void block(Long blockerId, Long targetId) {
        if (blockerId.equals(targetId)) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "You cannot block yourself");
        }
        if (!userRepository.existsById(targetId)) {
            throw new BusinessException(ErrorType.NOT_FOUND, "User profile not found [id=" + targetId + "]");
        }
        if (blockRepository.findByBlockerIdAndBlockedId(blockerId, targetId).isEmpty()) {
            blockRepository.save(UserBlock.builder().blockerId(blockerId).blockedId(targetId).build());
        }
        friendRequestRepository.findBetween(blockerId, targetId).ifPresent(friendRequestRepository::delete);
    }

    @Transactional
    public void unblock(Long blockerId, Long targetId) {
        blockRepository.findByBlockerIdAndBlockedId(blockerId, targetId).ifPresent(blockRepository::delete);
    }

    /** The people {@code blockerId} has blocked, most recent first. */
    @Transactional(readOnly = true)
    public List<BlockedUserDTO> list(Long blockerId) {
        List<BlockedUserDTO> out = new ArrayList<>();
        for (UserBlock b : blockRepository.findByBlockerIdOrderByCreatedAtDesc(blockerId)) {
            User u = userRepository.findById(b.getBlockedId()).orElse(null);
            if (u == null) continue;
            out.add(BlockedUserDTO.builder()
                    .userId(u.getId())
                    .username(u.getUsername())
                    .displayName(u.getDisplayName())
                    .profilePicture(u.getProfilePicture())
                    .build());
        }
        return out;
    }

    /** True when either of the two has blocked the other. */
    @Transactional(readOnly = true)
    public boolean isBlockedEitherWay(Long a, Long b) {
        return a != null && b != null && blockRepository.existsEitherWay(a, b);
    }
}
