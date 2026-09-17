package net.omnimedia.omni.network.repository;

import net.omnimedia.omni.network.entity.Network;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface NetworkRepository extends JpaRepository<Network, Long> {
    Optional<Network> findByInviteCode(String inviteCode);
}
