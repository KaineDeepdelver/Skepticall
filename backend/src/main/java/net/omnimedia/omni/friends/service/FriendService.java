package net.omnimedia.omni.friends.service;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.friends.entity.FriendRequest;
import net.omnimedia.omni.friends.repository.FriendRequestRepository;
import net.omnimedia.omni.user.entity.User;
import net.omnimedia.omni.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@RequiredArgsConstructor
public class FriendService {
    private final FriendRequestRepository repo;
    private final UserRepository userRepo;

    @Transactional
    public Map<String, Object> sendRequest(Long senderId, Long receiverId) {
        if (senderId.equals(receiverId)) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "You cannot send a friend request to yourself");
        }

        var existing = repo.findBetween(senderId, receiverId);
        if (existing.isPresent()) {
            FriendRequest r = existing.get();
            if ("ACCEPTED".equals(r.getStatus()))
                return Map.of("status", "ALREADY_FRIENDS", "requestId", r.getId());
            if ("PENDING".equals(r.getStatus()))
                return Map.of("status", "PENDING", "requestId", r.getId());

            // was rejected — reset
            r.setStatus("PENDING");
            r.setSender(userRepo.findById(senderId)
                    .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Sender profile not found [senderId=" + senderId + "]")));

            FriendRequest saved = repo.save(r);
            return Map.of("status", "PENDING", "requestId", saved.getId());
        }

        User sender = userRepo.findById(senderId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Sender profile not found [senderId=" + senderId + "]"));

        User receiver = userRepo.findById(receiverId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Receiver profile not found [receiverId=" + receiverId + "]"));

        FriendRequest saved = repo.save(FriendRequest.builder().sender(sender).receiver(receiver).build());
        return Map.of("status", "PENDING", "requestId", saved.getId());
    }


    @Transactional
    public Map<String, Object> respond(Long requestId, Long userId, String action) {
        FriendRequest r = repo.findById(requestId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Friend request not found [requestId=" + requestId + "]"));

        if (!r.getReceiver().getId().equals(userId)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "You are not authorized to respond to this friend request");
        }

        r.setStatus("ACCEPT".equalsIgnoreCase(action) ? "ACCEPTED" : "REJECTED");
        FriendRequest saved = repo.save(r);
        // Map ACCEPTED -> FRIENDS for frontend consistency
        String frontendStatus = "ACCEPTED".equals(saved.getStatus()) ? "FRIENDS" : saved.getStatus();
        return Map.of("status", frontendStatus, "requestId", saved.getId());
    }


    @Transactional
    public Map<String, Object> unfriend(Long userId, Long otherId) {
        repo.findBetween(userId, otherId).ifPresent(repo::delete);
        return Map.of("status", "REMOVED");
    }

    public Map<String, Object> getRelationship(Long viewerId, Long targetId) {
        var r = repo.findBetween(viewerId, targetId);
        if (r.isEmpty()) return Map.of("status", "NONE");
        FriendRequest req = r.get();
        if ("ACCEPTED".equals(req.getStatus()))
            return Map.of("status", "FRIENDS", "requestId", req.getId());
        if ("PENDING".equals(req.getStatus())) {
            boolean iSent = req.getSender().getId().equals(viewerId);
            return Map.of("status", iSent ? "REQUEST_SENT" : "REQUEST_RECEIVED", "requestId", req.getId());
        }
        return Map.of("status", "NONE");
    }

    public List<Map<String, Object>> getPendingRequests(Long userId) {
        return repo.findByReceiverIdAndStatus(userId, "PENDING").stream().map(r -> {
            User s = r.getSender();
            return Map.<String,Object>of(
                "requestId", r.getId(),
                "userId",    s.getId(),
                "username",  s.getUsername(),
                "displayName", Objects.toString(s.getDisplayName(), ""),
                "avatar",    Objects.toString(s.getProfilePicture(), "")
            );
        }).toList();
    }

    public List<Map<String, Object>> getFriends(Long userId) {
        return repo.findFriends(userId).stream().map(r -> {
            User other = r.getSender().getId().equals(userId) ? r.getReceiver() : r.getSender();
            return Map.<String,Object>of(
                "userId",      other.getId(),
                "username",    other.getUsername(),
                "displayName", Objects.toString(other.getDisplayName(), ""),
                "avatar",      Objects.toString(other.getProfilePicture(), "")
            );
        }).toList();
    }
}
