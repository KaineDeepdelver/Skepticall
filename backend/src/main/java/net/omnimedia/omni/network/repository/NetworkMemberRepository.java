package net.omnimedia.omni.network.repository;

import net.omnimedia.omni.network.entity.NetworkMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NetworkMemberRepository extends JpaRepository<NetworkMember, Long> {
    List<NetworkMember> findByNetworkId(Long networkId);

    List<NetworkMember> findByUserId(Long userId);

    Optional<NetworkMember> findByNetworkIdAndUserId(Long networkId, Long userId);

    boolean existsByNetworkIdAndUserId(Long networkId, Long userId);

    @Modifying
    @Query("DELETE FROM NetworkMember m WHERE m.network.id = :networkId AND m.user.id = :userId")
    void deleteByNetworkIdAndUserId(@Param("networkId") Long networkId, @Param("userId") Long userId);
}
