package net.omnimedia.omni.group.dto;

import lombok.*;

// See GroupMessageKey entity for the full explanation. One entry = one
// member's wrapped copy of one message's content or media key. Embedded
// as a list on GroupMessageDTO — every member's entries ride along in the
// same broadcast/history payload, and each client just picks out the
// entry matching its own user id.
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GroupMessageKeyDTO {
    private Long recipientId;
    private String keyType; // "CONTENT" | "MEDIA"
    private String wrappedKey;
    private String wrappedKeyNonce;
}
