package net.omnimedia.omni.network.repository;

import net.omnimedia.omni.network.entity.Channel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChannelRepository extends JpaRepository<Channel, Long> {
    List<Channel> findByNetworkIdOrderByPositionAsc(Long networkId);
}
