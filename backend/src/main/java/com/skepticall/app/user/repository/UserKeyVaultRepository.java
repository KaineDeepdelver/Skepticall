package com.skepticall.app.user.repository;

import com.skepticall.app.user.entity.UserKeyVault;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserKeyVaultRepository extends JpaRepository<UserKeyVault, Long> {

    Optional<UserKeyVault> findByUserId(Long userId);
}
