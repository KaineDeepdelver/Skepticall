package net.omnimedia.omni.network.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;
import net.omnimedia.omni.user.entity.User;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "networks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Network extends BaseEntity {

    private String name;
    private String iconUrl;
    private String bannerUrl;

    @ManyToOne
    @JoinColumn(name = "owner_id")
    private User owner;

    // Short, unique, shareable code — e.g. "aB3xQ9". Regeneratable by the owner.
    @Column(name = "invite_code", unique = true)
    private String inviteCode;

    // ── Server Profile ──────────────────────────────────────────────────
    @Column(columnDefinition = "TEXT")
    private String description;

    @Builder.Default
    @Column(name = "private_profile")
    private boolean privateProfile = false;

    // ── Access ───────────────────────────────────────────────────────────
    // "INVITE_ONLY" or "APPLY_TO_JOIN". Stored as a plain string rather than
    // @Enumerated so the frontend can send/receive it directly without a
    // conversion layer; validated in NetworkService instead.
    @Builder.Default
    @Column(name = "access_mode")
    private String accessMode = "INVITE_ONLY";

    @Builder.Default
    @Column(name = "age_restricted")
    private boolean ageRestricted = false;

    @Builder.Default
    @Column(name = "rules_enabled")
    private boolean rulesEnabled = false;

    @Builder.Default
    @ElementCollection
    @CollectionTable(name = "network_rules", joinColumns = @JoinColumn(name = "network_id"))
    @Column(name = "rule", columnDefinition = "TEXT")
    @OrderColumn(name = "rule_order")
    private List<String> rules = new ArrayList<>();

    // ── Safety Setup ─────────────────────────────────────────────────────
    @Builder.Default
    @Column(name = "require_2fa_for_moderation")
    private boolean require2faForModeration = false;

    @Builder.Default
    @Column(name = "restrict_prune_to_admins")
    private boolean restrictPruneToAdmins = false;
}
