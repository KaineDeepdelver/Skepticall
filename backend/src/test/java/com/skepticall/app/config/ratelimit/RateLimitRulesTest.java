package com.skepticall.app.config.ratelimit;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Which limit applies to which request. */
class RateLimitRulesTest {

    @Test
    void signInAndCodeEndpointsGetTheTightLimits() {
        assertEquals("login", RateLimitRules.forRequest("POST", "/users/login").name());
        assertEquals(10, RateLimitRules.forRequest("POST", "/users/login").limit());
        assertEquals("register", RateLimitRules.forRequest("POST", "/users/register").name());
        assertEquals("send-code", RateLimitRules.forRequest("POST", "/users/send-registration-code").name());
        assertEquals("send-code", RateLimitRules.forRequest("POST", "/users/send-reset-code").name());
        assertEquals("verify-code", RateLimitRules.forRequest("POST", "/users/verify-registration-code").name());
        assertEquals("verify-code", RateLimitRules.forRequest("POST", "/users/reset-password").name());
        assertEquals("lookup", RateLimitRules.forRequest("POST", "/users/check-email").name());
        assertEquals("report", RateLimitRules.forRequest("POST", "/reports").name());
    }

    @Test
    void theKeyBackupHasSeparateReadAndWriteLimits() {
        assertEquals("key-vault-read", RateLimitRules.forRequest("GET", "/users/me/key-vault").name());
        assertEquals("key-vault-write", RateLimitRules.forRequest("PUT", "/users/me/key-vault").name());
        assertEquals("key-vault-write", RateLimitRules.forRequest("DELETE", "/users/me/key-vault").name());
    }

    @Test
    void theSamePathWithAnotherMethodIsOrdinaryTraffic() {
        assertEquals("general", RateLimitRules.forRequest("GET", "/users/login").name());
        assertEquals("general", RateLimitRules.forRequest("GET", "/messages/1/2").name());
        assertEquals("general", RateLimitRules.forRequest("POST", "/messages/seen").name());
        assertEquals("general", RateLimitRules.forRequest(null, null).name());
    }

    @Test
    void methodMatchingIsCaseInsensitive() {
        assertEquals("login", RateLimitRules.forRequest("post", "/users/login").name());
    }

    @Test
    void theLiveSocketFilesPreflightsAndErrorsAreNeverLimited() {
        assertTrue(RateLimitRules.exempt("GET", "/ws"));
        assertTrue(RateLimitRules.exempt("GET", "/ws-native/info"));
        assertTrue(RateLimitRules.exempt("GET", "/uploads/pic.png"));
        assertTrue(RateLimitRules.exempt("GET", "/error"));
        assertTrue(RateLimitRules.exempt("OPTIONS", "/users/login"));
        assertFalse(RateLimitRules.exempt("POST", "/users/login"));
        assertFalse(RateLimitRules.exempt("GET", "/messages/1/2"));
    }

    @Test
    void theGeneralLimitIsGenerousEnoughForRealUse() {
        var general = RateLimitRules.forRequest("GET", "/anything");
        assertTrue(general.limit() >= 300, "a busy but honest client must not hit it");
        assertEquals(60_000L, general.windowMillis());
    }
}
