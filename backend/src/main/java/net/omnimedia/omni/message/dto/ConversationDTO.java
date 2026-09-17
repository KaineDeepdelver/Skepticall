package net.omnimedia.omni.message.dto;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationDTO {
    private Long userId;
    private String name;
    private String username;
    private String avatar;

    private int unread;
    private String lastMsg;
    private LocalDateTime lastTime;
}