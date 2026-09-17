package net.omnimedia.omni.exceptions;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler extends RuntimeException {
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<String> handleBusinessException(BusinessException ex) {
        // 🧼 Prints exactly ONE clean sentence with your chosen emoji to the console
        log.warn("{} Business Rule Violation: {}", ex.getType().getEmoji(), ex.getMessage());

        // Sends the message back to the frontend with a clean 400 Bad Request status
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
    }
}
