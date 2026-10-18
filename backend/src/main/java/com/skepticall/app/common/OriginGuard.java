package com.skepticall.app.common;

import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.exceptions.ErrorType;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * CSRF protection for the endpoints that act on the remember-me cookie.
 *
 * <p>The cookie is {@code SameSite=None} (the web app and API are on different sites), so a
 * malicious page could make the browser send it. Those requests carry an {@code Origin} header, so
 * we only accept our own frontends. Requests with no Origin and no Referer (native apps, curl) are
 * not browser CSRF and are let through.
 */
@Component
public class OriginGuard {

    private final List<String> allowed;

    public OriginGuard(@Value("${app.cors.allowed-origins:http://localhost:3000}") String allowedOrigins) {
        this.allowed = Arrays.stream(allowedOrigins.split(","))
                .map(OriginGuard::normalize).filter(o -> !o.isEmpty()).toList();
    }

    static String normalize(String origin) {
        String o = origin == null ? "" : origin.trim().toLowerCase(Locale.ROOT);
        return o.endsWith("/") ? o.substring(0, o.length() - 1) : o;
    }

    /** True if the request may proceed. {@code origin} / {@code referer} are the raw header values (nullable). */
    public static boolean isTrusted(String origin, String referer, List<String> allowedOrigins) {
        if (origin != null && !origin.isBlank()) {
            return allowedOrigins.contains(normalize(origin)); // includes the literal "null" origin: refused
        }
        if (referer != null && !referer.isBlank()) {
            try {
                URI u = URI.create(referer.trim());
                if (u.getScheme() == null || u.getHost() == null) return false;
                String base = u.getScheme() + "://" + u.getHost() + (u.getPort() > 0 ? ":" + u.getPort() : "");
                return allowedOrigins.contains(normalize(base));
            } catch (IllegalArgumentException e) {
                return false;
            }
        }
        return true;
    }

    public void requireTrusted(HttpServletRequest req) {
        if (!isTrusted(req.getHeader("Origin"), req.getHeader("Referer"), allowed)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "This request did not come from an allowed site");
        }
    }
}
