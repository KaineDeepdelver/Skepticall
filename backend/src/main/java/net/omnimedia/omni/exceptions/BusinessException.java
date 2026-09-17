package net.omnimedia.omni.exceptions;

import lombok.Getter;

@Getter
public class BusinessException extends RuntimeException {
    // 🧼 Cleaned: Now strictly references your custom ErrorType enum
    private final ErrorType type;

    public BusinessException(ErrorType type, String message) {
        super(message);
        this.type = type;
    }
}
