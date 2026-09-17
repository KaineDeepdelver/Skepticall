package net.omnimedia.omni.notification.dto;

import lombok.Data;

@Data
public class PushTokenDTO {
    private String token;
    private String platform; // "ios" | "android"
}
