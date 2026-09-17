package net.omnimedia.omni.network.repository;

import net.omnimedia.omni.network.entity.NetworkBan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NetworkBanRepository extends JpaRepository<NetworkBan, Long> {
    List<NetworkBan> findByNetworkIdOrderByCreatedAtDesc(Long networkId);

    Optional<NetworkBan> findByNetworkIdAndBannedUserId(Long networkId, Long bannedUserId);

    boolean existsByNetworkIdAndBannedUserId(Long networkId, Long bannedUserId);

    @Modifying
    @Query("DELETE FROM NetworkBan b WHERE b.network.id = :networkId AND b.bannedUser.id = :userId")
    void deleteByNetworkIdAndBannedUserId(@Param("networkId") Long networkId, @Param("userId") Long userId);
}
