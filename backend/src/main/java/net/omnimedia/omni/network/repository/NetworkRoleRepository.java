package net.omnimedia.omni.network.repository;

import net.omnimedia.omni.network.entity.NetworkRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NetworkRoleRepository extends JpaRepository<NetworkRole, Long> {
    List<NetworkRole> findByNetworkIdOrderByPositionDesc(Long networkId);

    Optional<NetworkRole> findByNetworkIdAndIsDefaultTrue(Long networkId);

    @Query("SELECT COALESCE(MAX(r.position), -1) FROM NetworkRole r WHERE r.network.id = :networkId")
    int findMaxPosition(@Param("networkId") Long networkId);
}
