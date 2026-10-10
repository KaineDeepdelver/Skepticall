package net.omnimedia.omni.config;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * The "remember me" cookie: an HttpOnly cookie holding a long-lived remember
 * token (see JwtUtil.generateRemember). JavaScript can't read it, and it is
 * only sent to /users/** — in practice /users/session and /users/logout.
 */
@Component
public class RememberCookie {

    public static final String NAME = "omni_remember";

    private final long days;
    private final boolean secure;
    private final String sameSite;

    public RememberCookie(
            @Value("${auth.remember.days:30}") long days,
            @Value("${auth.cookie.secure:true}") boolean secure,
            @Value("${auth.cookie.same-site:None}") String sameSite
    ) {
        this.days = days;
        this.secure = secure;
        this.sameSite = sameSite;
    }

    public long ttlMs() {
        return Duration.ofDays(days).toMillis();
    }

    public void set(HttpServletResponse res, String token) {
        res.addHeader(HttpHeaders.SET_COOKIE, build(token, Duration.ofDays(days)).toString());
    }

    public void clear(HttpServletResponse res) {
        res.addHeader(HttpHeaders.SET_COOKIE, build("", Duration.ZERO).toString());
    }

    private ResponseCookie build(String value, Duration maxAge) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite(sameSite)
                .path("/users")
                .maxAge(maxAge)
                .build();
    }
}
