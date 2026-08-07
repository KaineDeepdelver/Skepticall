package net.omnimedia.omni.verification.repository;

import net.omnimedia.omni.verification.entity.VerificationCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface VerificationCodeRepository extends JpaRepository<VerificationCode, Long> {

    @Query("SELECT v FROM VerificationCode v WHERE v.email = :email AND v.type = :type AND v.used = false ORDER BY v.expiresAt DESC LIMIT 1")
    Optional<VerificationCode> findLatestCode(@Param("email") String email, @Param("type") VerificationCode.CodeType type);

    void deleteAllByEmail(String email);
}
