package net.omnimedia.omni.follow.service;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.follow.entity.Follow;
import net.omnimedia.omni.follow.repository.FollowRepository;
import net.omnimedia.omni.user.entity.User;
import net.omnimedia.omni.notification.service.NotificationService;
import net.omnimedia.omni.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;

@Service @RequiredArgsConstructor
public class FollowService {
    private final FollowRepository repo;
    private final UserRepository   userRepo;
    private final NotificationService notifService;

    @Transactional
    public Map<String, Object> toggle(Long followerId, Long followingId) {
        if (followerId.equals(followingId)) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "You cannot follow your own account");
        }

        var existing = repo.findByFollowerIdAndFollowingId(followerId, followingId);
        boolean nowFollowing;
        if (existing.isPresent()) {
            repo.delete(existing.get());
            nowFollowing = false;
        } else {
            User follower = userRepo.findById(followerId)
                    .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Follower profile not found [id=" + followerId + "]"));

            User following = userRepo.findById(followingId)
                    .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Target profile to follow not found [id=" + followingId + "]"));

            repo.save(Follow.builder().follower(follower).following(following).build());
            nowFollowing = true;
            notifService.notifyFollow(followerId, followingId);
        }

        // Persist updated counts on both User rows
        long newFollowerCount  = repo.countByFollowingId(followingId);
        long newFollowingCount = repo.countByFollowerId(followerId);

        userRepo.findById(followingId).ifPresent(u -> {
            u.setFollowerCount((int) newFollowerCount);
            userRepo.save(u);
        });
        userRepo.findById(followerId).ifPresent(u -> {
            u.setFollowingCount((int) newFollowingCount);
            userRepo.save(u);
        });

        return Map.of(
                "following",      nowFollowing,
                "followerCount",  newFollowerCount,
                "followingCount", newFollowingCount
        );
    }


    public Map<String, Object> status(Long viewerId, Long targetId) {
        boolean following = repo.findByFollowerIdAndFollowingId(viewerId, targetId).isPresent();
        return Map.of(
            "following",      following,
            "followerCount",  repo.countByFollowingId(targetId),
            "followingCount", repo.countByFollowerId(targetId)
        );
    }
}
