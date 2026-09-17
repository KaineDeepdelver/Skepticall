package net.omnimedia.omni.group.entity;
import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;
import net.omnimedia.omni.user.entity.User;
import java.util.*;

@Entity
@Table(name="group_conversations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder

public class GroupConversation extends BaseEntity {

    private String name;
    private String avatarUrl;

    @ManyToOne
    @JoinColumn(name="creator_id")
    private User creator;

    @ManyToMany
    @JoinTable(
            name="group_members",
            joinColumns=@JoinColumn(name="group_id"),
            inverseJoinColumns=@JoinColumn(name="user_id")
    )
    @Builder.Default
    private List<User> members = new ArrayList<>();

    // Permissions — true means ALL members can do it, false means admin only
    @Builder.Default
    @Column(name="perm_edit_settings")
    private Boolean permEditSettings = false;

    @Builder.Default
    @Column(name="perm_send_messages")
    private Boolean permSendMessages = true;

    @Builder.Default
    @Column(name="perm_add_members")
    private Boolean permAddMembers = false;
}
