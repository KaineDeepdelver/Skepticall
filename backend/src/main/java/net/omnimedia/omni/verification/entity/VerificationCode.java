package net.omnimedia.omni.verification.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "verification_codes")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class VerificationCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String email;
    private String code;

    @Enumerated(EnumType.STRING)
    private CodeType type;

    private LocalDateTime expiresAt;
    private boolean used;

    public enum CodeType {
        REGISTRATION, FORGOT_PASSWORD
    }
}