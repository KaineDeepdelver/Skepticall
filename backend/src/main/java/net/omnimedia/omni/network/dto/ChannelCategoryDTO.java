package net.omnimedia.omni.network.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChannelCategoryDTO {
    private Long id;
    private Long networkId;
    private String name;
    private int position;
}
