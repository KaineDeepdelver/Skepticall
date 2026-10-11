package com.skepticall.app.admin.repository;

import com.skepticall.app.admin.entity.Admin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AdminRepository extends JpaRepository<Admin, Long> {
    Optional<Admin> findByUserId(Long userId);
    boolean existsByUserId(Long userId);
}
