package com.skepticall.app.config.jwt;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilTest {

    // HS256 needs a key of at least 32 bytes
    private static final String SECRET = "unit-test-secret-unit-test-secret-0123456789";
    private static final String OTHER_SECRET = "another-test-secret-another-test-secret-9876";
    private static final long ONE_MINUTE = 60_000L;

    private JwtUtil jwt() {
        return new JwtUtil(SECRET, ONE_MINUTE);
    }

    @Test
    void accessTokenRoundTripsTheUserId() {
        JwtUtil jwt = jwt();
        String token = jwt.generate(42L, false);

        assertTrue(jwt.isValid(token));
        assertEquals(42L, jwt.extractUserId(token));
    }

    @Test
    void adminFlagIsCarriedInTheToken() {
        JwtUtil jwt = jwt();

        assertEquals(Boolean.TRUE, jwt.parse(jwt.generate(1L, true)).get("admin", Boolean.class));
        assertEquals(Boolean.FALSE, jwt.parse(jwt.generate(1L, false)).get("admin", Boolean.class));
    }

    @Test
    void rememberTokenCanNeverBeUsedAsAnAccessToken() {
        JwtUtil jwt = jwt();
        String remember = jwt.generateRemember(7L, "tag", ONE_MINUTE);

        assertFalse(jwt.isValid(remember));
        assertNull(jwt.extractUserId(remember));
        assertNotNull(jwt.parseRemember(remember));
    }

    @Test
    void accessTokenIsNotAcceptedAsARememberToken() {
        JwtUtil jwt = jwt();

        assertNull(jwt.parseRemember(jwt.generate(7L, false)));
    }

    @Test
    void tokenSignedWithAnotherSecretIsRejected() {
        String forged = new JwtUtil(OTHER_SECRET, ONE_MINUTE).generate(1L, true);

        assertFalse(jwt().isValid(forged));
        assertNull(jwt().extractUserId(forged));
    }

    @Test
    void expiredTokenIsRejected() {
        String expired = new JwtUtil(SECRET, -1_000L).generate(1L, false);

        assertFalse(jwt().isValid(expired));
    }

    @Test
    void garbageIsRejectedWithoutThrowing() {
        JwtUtil jwt = jwt();

        assertFalse(jwt.isValid("not-a-jwt"));
        assertNull(jwt.parseRemember("not-a-jwt"));
    }

    @Test
    void passwordTagIsStableAndChangesWithThePassword() {
        assertEquals(JwtUtil.passwordTag("hash-a"), JwtUtil.passwordTag("hash-a"));
        assertNotEquals(JwtUtil.passwordTag("hash-a"), JwtUtil.passwordTag("hash-b"));
    }
}
