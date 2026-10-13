package com.skepticall.app.user.repository;

import com.skepticall.app.user.entity.UserPublicKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserPublicKeyRepository extends JpaRepository<UserPublicKey, Long> {

    Optional<UserPublicKey> findFirstByUserIdAndRetiredAtIsNullOrderByCreatedAtDesc(Long userId);

    boolean existsByUserIdAndPublicKey(Long userId, String publicKey);

    /** The current key plus every key retired after {@code cutoff} (i.e. still inside the grace period), newest first. */
    @Query("select k from UserPublicKey k where k.userId = :userId "
            + "and (k.retiredAt is null or k.retiredAt > :cutoff) order by k.activatedAt desc")
    List<UserPublicKey> findValid(@Param("userId") Long userId, @Param("cutoff") LocalDateTime cutoff);

    @Modifying
    @Query("delete from UserPublicKey k where k.retiredAt is not null and k.retiredAt <= :cutoff")
    int deleteExpired(@Param("cutoff") LocalDateTime cutoff);
}
