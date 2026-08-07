package net.omnimedia.omni.group.repository;
import net.omnimedia.omni.group.entity.GroupConversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
public interface GroupConversationRepository extends JpaRepository<GroupConversation, Long> {
    @Query("SELECT DISTINCT g FROM GroupConversation g JOIN g.members m WHERE m.id = :userId")
    List<GroupConversation> findByMemberId(@Param("userId") Long userId);

    @Query("SELECT g FROM GroupConversation g WHERE g.creator.id = :userId")
    List<GroupConversation> findByCreatorId(@Param("userId") Long userId);
}
