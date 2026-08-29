package net.omnimedia.omni.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompAuthInterceptor stompAuthInterceptor;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*") // important for dev
                .withSockJS(); // 👈 REQUIRED for SockJS (web client)

        // Native clients (React Native, no SockJS available in Hermes)
        // connect here directly with a plain WebSocket — no SockJS
        // handshake/session framing involved. Hitting the SockJS
        // endpoint's raw `/ws/websocket` shortcut instead of this looked
        // like it worked (the WebSocket itself opens fine) but never
        // actually got wired into the STOMP sub-protocol handler —
        // CONNECT frames sent that way were silently dropped, which is
        // why mobile could never complete a STOMP handshake while web
        // (going through real SockJS negotiation) worked fine.
        registry.addEndpoint("/ws-native")
                .setAllowedOriginPatterns("*");
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/queue", "/topic");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Runs on every inbound STOMP frame (CONNECT, SEND, SUBSCRIBE...).
        // The interceptor only acts on CONNECT — it validates the JWT once
        // and the resulting Principal sticks to the session for every
        // subsequent frame, so @MessageMapping handlers can trust it.
        registration.interceptors(stompAuthInterceptor);
    }
}
