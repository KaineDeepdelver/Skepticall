package net.omnimedia.omni.user.repository;

import net.omnimedia.omni.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    List<User> findByDisplayNameContainingIgnoreCaseOrUsernameContainingIgnoreCase(
            String displayName,
            String username
    );
}
