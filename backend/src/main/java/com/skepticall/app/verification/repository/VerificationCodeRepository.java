package com.skepticall.app.verification.repository;

import com.skepticall.app.verification.entity.VerificationCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface VerificationCodeRepository extends JpaRepository<VerificationCode, Long> {

    @Query("SELECT v FROM VerificationCode v WHERE v.email = :email AND v.type = :type AND v.used = false ORDER BY v.expiresAt DESC LIMIT 1")
    Optional<VerificationCode> findLatestCode(@Param("email") String email, @Param("type") VerificationCode.CodeType type);

    /** A sign-up code the person has already entered correctly and that hasn't run out yet. */
    @Query("SELECT v FROM VerificationCode v WHERE v.email = :email AND v.type = :type AND v.used = true AND v.expiresAt > :now ORDER BY v.expiresAt DESC LIMIT 1")
    Optional<VerificationCode> findVerified(@Param("email") String email,
                                            @Param("type") VerificationCode.CodeType type,
                                            @Param("now") java.time.LocalDateTime now);

    void deleteAllByEmail(String email);
}
