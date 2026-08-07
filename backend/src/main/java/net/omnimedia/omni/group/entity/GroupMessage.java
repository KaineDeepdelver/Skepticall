package net.omnimedia.omni.group.entity;
import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;
import net.omnimedia.omni.user.entity.User;
@Entity @Table(name="group_messages")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GroupMessage extends BaseEntity {

    @ManyToOne
    @JoinColumn(name="group_id")
    private GroupConversation group;

    @ManyToOne
    @JoinColumn(name="sender_id")
    private User sender;

    @Column(columnDefinition="TEXT")
    private String content;

    private String type;
    private String fileUrl;

    @Builder.Default
    private Boolean edited = false;
    private String status;
}
