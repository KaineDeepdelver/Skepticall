package net.omnimedia.omni.network.dto;

import lombok.*;

import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NetworkDTO {
    private Long id;
    private String name;
    private String iconUrl;
    private String bannerUrl;
    private Long ownerId;
    private String inviteCode;
    private int memberCount;
    private List<ChannelDTO> channels;
    private List<ChannelCategoryDTO> categories;
    private List<NetworkRoleDTO> roles;

    // ── Server Profile ──────────────────────────────────────────────────
    private String description;
    private boolean privateProfile;

    // ── Access ───────────────────────────────────────────────────────────
    private String accessMode;
    private boolean ageRestricted;
    private boolean rulesEnabled;
    private List<String> rules;

    // ── Safety Setup ─────────────────────────────────────────────────────
    private boolean require2faForModeration;
    private boolean restrictPruneToAdmins;
}
