package com.skepticall.app.config.ratelimit;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Turns away a client that is making too many requests, with a 429 and a Retry-After header.
 *
 * <p>Added to the security chain (see SecurityConfig), not registered as a bean, so it runs after CORS
 * handling: the browser then receives the 429 with its CORS headers and the app can show a clear message
 * instead of a vague network error. Counters are in memory and keyed by client address; nothing is logged
 * or stored.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private final boolean enabled;
    private final FixedWindowRateLimiter limiter;

    public RateLimitFilter(boolean enabled) {
        this(enabled, new FixedWindowRateLimiter(System::currentTimeMillis, 50_000));
    }

    RateLimitFilter(boolean enabled, FixedWindowRateLimiter limiter) {
        this.enabled = enabled;
        this.limiter = limiter;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !enabled || RateLimitRules.exempt(request.getMethod(), request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        RateLimitRules.Rule rule = RateLimitRules.forRequest(request.getMethod(), request.getRequestURI());
        var decision = limiter.tryAcquire(rule.name() + "|" + clientIp(request), rule.limit(), rule.windowMillis());
        if (decision.allowed()) {
            chain.doFilter(request, response);
            return;
        }
        response.setStatus(429);
        response.setHeader("Retry-After", String.valueOf(decision.retryAfterSeconds()));
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"message\":\"Too many requests. Please wait a moment and try again.\"}");
    }

    // Same rule as the rest of the app: behind Cloudflare / Render the socket address is the proxy.
    private static String clientIp(HttpServletRequest req) {
        String ip = req.getHeader("CF-Connecting-IP");
        if (ip == null || ip.isBlank()) {
            String xff = req.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) ip = xff.split(",")[0].trim();
        }
        if (ip == null || ip.isBlank()) ip = req.getRemoteAddr();
        return ip;
    }
}
