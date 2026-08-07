package net.omnimedia.omni.network.repository;

import net.omnimedia.omni.network.entity.ChannelMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChannelMessageRepository extends JpaRepository<ChannelMessage, Long> {
    Page<ChannelMessage> findByChannelIdOrderByCreatedAtDesc(Long channelId, Pageable pageable);

    // == Admin account deletion — wipe every channel message this user sent,
    //    mirrors GroupMessageRepository#deleteAllBySenderId ==
    @Modifying
    @Query("DELETE FROM ChannelMessage m WHERE m.author.id = :userId")
    void deleteAllByAuthorId(@Param("userId") Long userId);
}
