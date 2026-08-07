package net.omnimedia.omni.network.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;

@Entity
@Table(name = "channels")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Channel extends BaseEntity {

    public enum Type { TEXT, VOICE, ANNOUNCEMENT }

    @ManyToOne
    @JoinColumn(name = "network_id")
    private Network network;

    // Nullable — an "uncategorized" channel sits above any category in the list.
    @ManyToOne
    @JoinColumn(name = "category_id")
    private ChannelCategory category;

    private String name;

    @Enumerated(EnumType.STRING)
    private Type type;

    @Builder.Default
    private int position = 0;
}
