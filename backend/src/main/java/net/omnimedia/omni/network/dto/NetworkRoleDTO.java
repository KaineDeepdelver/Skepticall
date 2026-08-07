package net.omnimedia.omni.network.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class NetworkRoleDTO {
    private Long id;
    private Long networkId;
    private String name;
    private String color;
    private int position;
    private long permissions;
    private boolean isDefault;
}
