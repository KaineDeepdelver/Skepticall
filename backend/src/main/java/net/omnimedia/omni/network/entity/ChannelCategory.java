package net.omnimedia.omni.network.entity;

import jakarta.persistence.*;
import lombok.*;
import net.omnimedia.omni.common.BaseEntity;

@Entity
@Table(name = "channel_categories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChannelCategory extends BaseEntity {

    @ManyToOne
    @JoinColumn(name = "network_id")
    private Network network;

    private String name;

    @Builder.Default
    private int position = 0;
}
