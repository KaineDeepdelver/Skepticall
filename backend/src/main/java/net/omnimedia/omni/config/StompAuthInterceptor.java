package net.omnimedia.omni.config;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.config.jwt.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.List;

@Component
@RequiredArgsConstructor
public class StompAuthInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(StompAuthInterceptor.class);

    private final JwtUtil jwtUtil;

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
        // Use getAccessor so we get the MUTABLE accessor already attached to the message
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) return message;

        StompCommand command = accessor.getCommand();

        if (StompCommand.CONNECT.equals(command)) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            String token = (authHeader != null && authHeader.startsWith("Bearer "))
                    ? authHeader.substring(7)
                    : null;

            if (token == null || !jwtUtil.isValid(token)) {
                log.warn("🔐⛔ WebSocket REJECTED: Missing or invalid token [sessionId={}]", accessor.getSessionId());
                return null;
            }

            Long userId = jwtUtil.extractUserId(token);
            List<SimpleGrantedAuthority> authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
            Principal principal = new UsernamePasswordAuthenticationToken(
                    String.valueOf(userId), null, authorities);

            // Mutate the accessor directly — this is the correct way in Spring 6+
            accessor.setUser(principal);
            log.info("🔐✅ WebSocket connection authenticated [userId={}]", userId);
        }

        return message;
    }
}