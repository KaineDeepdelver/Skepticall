package net.omnimedia.omni.config;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.config.jwt.JwtFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    // Origins allowed to make credentialed (cookie) requests to the remember-me endpoints.
    @org.springframework.beans.factory.annotation.Value("${app.cors.allowed-origins:http://localhost:3000}")
    private String allowedOrigins;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();

        // The remember-me endpoints hand out a token to whoever holds the cookie, so they must
        // only answer our own frontend(s) — never "*". Registered before "/**" so they win.
        CorsConfiguration cookieCors = new CorsConfiguration();
        cookieCors.setAllowCredentials(true);
        cookieCors.setAllowedOrigins(java.util.Arrays.stream(allowedOrigins.split(","))
                .map(String::trim).filter(o -> !o.isEmpty()).toList());
        cookieCors.setAllowedHeaders(List.of("*"));
        cookieCors.setAllowedMethods(List.of("POST", "OPTIONS"));
        source.registerCorsConfiguration("/users/session", cookieCors);
        source.registerCorsConfiguration("/users/logout", cookieCors);

        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth

                        // Allow all CORS preflight requests
                        .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()

                        // Public auth endpoints
                        .requestMatchers(
                                "/users/register", "/users/login",
                                "/users/check-email", "/users/check-username",
                                "/users/send-registration-code", "/users/verify-registration-code",
                                "/users/send-reset-code", "/users/reset-password",
                                "/users/session", "/users/logout"
                        ).permitAll()

                        // Public read endpoints
                        .requestMatchers(
                                "/ping",
                                "/users/*/presence",
                                "/posts", "/posts/search", "/posts/user/**", "/posts/*", "/posts/slug/**",
                                "/media", "/media/search", "/media/user/**", "/media/*",
                                "/comments/**",
                                "/messages/*/*",
                                "/users/search",
                                "/follow/*/status",
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/friends/relationship/*"

                        ).permitAll()

                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/users/*").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/users/by-username/**").permitAll()

                        .requestMatchers("/ws/**", "/ws-native/**", "/uploads/**").permitAll()

                        .requestMatchers("/admin/**").hasRole("ADMIN")

                        .anyRequest().authenticated()
                )
                .httpBasic(h -> h.disable())
                .formLogin(f -> f.disable())
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
