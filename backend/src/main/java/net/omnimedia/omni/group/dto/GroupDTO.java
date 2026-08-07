package net.omnimedia.omni.group.dto;
import lombok.*;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GroupDTO {
    private Long id;
    private String name;
    private String avatarUrl;
    private Long creatorId;
    private List<MemberDTO> members;
    private int memberCount;

    // Permissions
    private Boolean permEditSettings;
    private Boolean permSendMessages;
    private Boolean permAddMembers;
}
