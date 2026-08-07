package net.omnimedia.omni.network.repository;

import net.omnimedia.omni.network.entity.ChannelCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChannelCategoryRepository extends JpaRepository<ChannelCategory, Long> {
    List<ChannelCategory> findByNetworkIdOrderByPositionAsc(Long networkId);

    @Query("SELECT COALESCE(MAX(c.position), -1) FROM ChannelCategory c WHERE c.network.id = :networkId")
    int findMaxPosition(@Param("networkId") Long networkId);
}
