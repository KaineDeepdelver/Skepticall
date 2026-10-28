package com.skepticall.app.config.ratelimit;

/**
 * Which limit applies to which request. Sign-in and the email-code endpoints are the tightest, because those
 * are where guessing and spam happen. Everything else shares one generous cap that only a flood would hit.
 * All limits are per client address.
 */
public final class RateLimitRules {

    /** A named limit: {@code limit} requests per {@code windowMillis}. */
    public record Rule(String name, int limit, long windowMillis) {}

    private static final long MINUTE = 60_000L;
    private static final long TEN_MINUTES = 10 * MINUTE;
    private static final long HOUR = 60 * MINUTE;

    private static final Rule LOGIN = new Rule("login", 10, MINUTE);
    private static final Rule REGISTER = new Rule("register", 10, HOUR);
    private static final Rule SEND_CODE = new Rule("send-code", 5, TEN_MINUTES);
    private static final Rule VERIFY_CODE = new Rule("verify-code", 15, TEN_MINUTES);
    private static final Rule LOOKUP = new Rule("lookup", 30, MINUTE);
    private static final Rule REPORT = new Rule("report", 20, HOUR);
    private static final Rule KEY_VAULT_WRITE = new Rule("key-vault-write", 10, HOUR);
    private static final Rule KEY_VAULT_READ = new Rule("key-vault-read", 30, MINUTE);
    private static final Rule GENERAL = new Rule("general", 600, MINUTE);

    private RateLimitRules() {}

    public static Rule forRequest(String method, String path) {
        String m = method == null ? "" : method.toUpperCase();
        String p = path == null ? "" : path;
        boolean post = "POST".equals(m);

        if (post && p.equals("/users/login")) return LOGIN;
        if (post && p.equals("/users/register")) return REGISTER;
        if (post && (p.equals("/users/send-registration-code") || p.equals("/users/send-reset-code"))) return SEND_CODE;
        if (post && (p.equals("/users/verify-registration-code") || p.equals("/users/reset-password"))) return VERIFY_CODE;
        if (post && (p.equals("/users/check-email") || p.equals("/users/session"))) return LOOKUP;
        if (post && p.equals("/reports")) return REPORT;
        if (p.equals("/users/me/key-vault")) {
            return "GET".equals(m) ? KEY_VAULT_READ : KEY_VAULT_WRITE;
        }
        return GENERAL;
    }

    /** Paths that are never limited: the live socket, file downloads and the framework's error page. */
    public static boolean exempt(String method, String path) {
        if ("OPTIONS".equalsIgnoreCase(method)) return true;
        String p = path == null ? "" : path;
        return p.startsWith("/ws") || p.startsWith("/uploads") || p.equals("/error");
    }
}
