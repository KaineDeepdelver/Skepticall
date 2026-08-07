package net.omnimedia.omni.user.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ProfileDTO {

    @Size(max = 255, message = "Profile picture URL is too long")
    private String profilePicture;

    @Size(max = 30, message = "Display name must be under 30 characters")
    private String displayName;

    @Size(max = 160, message = "Bio must be under 160 characters")
    private String bio;
}