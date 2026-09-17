package net.omnimedia.omni.network.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChannelDTO {
    private Long id;
    private Long networkId;
    private Long categoryId; // null == uncategorized
    private String name;
    private String type; // TEXT | VOICE | ANNOUNCEMENT
    private int position;
}
