package com.skepticall.app.common;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class OriginGuardTest {

    private static final List<String> ALLOWED = List.of("https://app.skepticall.com", "http://localhost:3000");

    @Test
    void ourOwnSitesAreAccepted() {
        assertTrue(OriginGuard.isTrusted("https://app.skepticall.com", null, ALLOWED));
        assertTrue(OriginGuard.isTrusted("https://APP.skepticall.com/", null, ALLOWED)); // case and trailing slash
        assertTrue(OriginGuard.isTrusted("http://localhost:3000", null, ALLOWED));
    }

    @Test
    void otherSitesAreRefused() {
        assertFalse(OriginGuard.isTrusted("https://evil.example", null, ALLOWED));
        assertFalse(OriginGuard.isTrusted("https://app.skepticall.com.evil.example", null, ALLOWED));
        assertFalse(OriginGuard.isTrusted("http://app.skepticall.com", null, ALLOWED)); // wrong scheme
        assertFalse(OriginGuard.isTrusted("null", null, ALLOWED)); // sandboxed iframes and data: pages
    }

    @Test
    void theOriginWinsOverTheReferer() {
        assertFalse(OriginGuard.isTrusted("https://evil.example", "https://app.skepticall.com/page", ALLOWED));
    }

    @Test
    void withoutAnOriginTheRefererIsChecked() {
        assertTrue(OriginGuard.isTrusted(null, "https://app.skepticall.com/settings?x=1", ALLOWED));
        assertFalse(OriginGuard.isTrusted(null, "https://evil.example/page", ALLOWED));
        assertFalse(OriginGuard.isTrusted(null, "not a url", ALLOWED));
    }

    @Test
    void requestsWithNeitherHeaderAreNotBrowserCsrfAndPassThrough() {
        assertTrue(OriginGuard.isTrusted(null, null, ALLOWED));
        assertTrue(OriginGuard.isTrusted("", "", ALLOWED));
    }
}
