package net.omnimedia.omni.friends.repository;

import net.omnimedia.omni.friends.entity.FriendRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List; import java.util.Optional;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {
    Optional<FriendRequest> findBySenderIdAndReceiverId(Long senderId, Long receiverId);

    @Query("SELECT r FROM FriendRequest r WHERE (r.sender.id=:a AND r.receiver.id=:b) OR (r.sender.id=:b AND r.receiver.id=:a)")
    Optional<FriendRequest> findBetween(Long a, Long b);

    List<FriendRequest> findByReceiverIdAndStatus(Long receiverId, String status);
    List<FriendRequest> findBySenderIdAndStatus(Long senderId, String status);

    @Query("SELECT r FROM FriendRequest r WHERE (r.sender.id=:userId OR r.receiver.id=:userId) AND r.status='ACCEPTED'")
    List<FriendRequest> findFriends(Long userId);

    // == Admin account deletion — wipe every friend request/relationship this user is part of ==
    @Modifying
    @Query("DELETE FROM FriendRequest r WHERE r.sender.id = :userId OR r.receiver.id = :userId")
    void deleteAllForUser(@Param("userId") Long userId);
}
