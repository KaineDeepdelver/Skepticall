package net.omnimedia.omni.exceptions;

import lombok.Getter;

@Getter
public enum ErrorType {
    INVALID_TOKEN("🔐⛔"),
    PERMISSION_DENIED("🛡️❌"),
    INVALID_OPERATION("⛔"),
    NOT_FOUND("🔍⚠️");

    private final String emoji;

    ErrorType(String emoji) {
        this.emoji = emoji;
    }
}
