package com.skepticall.app.notification.repository;

import com.skepticall.app.notification.entity.PushToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PushTokenRepository extends JpaRepository<PushToken, Long> {
    List<PushToken> findByUserId(Long userId);
    Optional<PushToken> findByToken(String token);
    void deleteByToken(String token);
}
