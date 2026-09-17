package net.omnimedia.omni.post.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder

public class PostMediaDTO {
    private Long id;
    private String mediaType;
    private String mediaUrl;
    private int position;
}
