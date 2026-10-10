package net.omnimedia.omni.config.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;

@Component
public class JwtUtil {

    private final Key signingKey;
    private final long expirationMs;

    public JwtUtil(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration-ms}") long expirationMs
    ) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes());
        this.expirationMs = expirationMs;
    }

    public String generate(Long userId, boolean admin) {
        return Jwts.builder()
                .setSubject(String.valueOf(userId))
                .claim("admin", admin)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();
    }

    private static final String REMEMBER = "remember";

    private Claims parseAny(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(signingKey)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    /** Access tokens only — a remember token is rejected here, so it can never be used as a Bearer/WebSocket token. */
    public Claims parse(String token) {
        Claims claims = parseAny(token);
        if (REMEMBER.equals(claims.get("typ", String.class))) {
            throw new JwtException("Remember token is not an access token");
        }
        return claims;
    }

    /** Long-lived token for the remember-me cookie. pwTag ties it to the current password. */
    public String generateRemember(Long userId, String pwTag, long ttlMs) {
        return Jwts.builder()
                .setSubject(String.valueOf(userId))
                .claim("typ", REMEMBER)
                .claim("pw", pwTag)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + ttlMs))
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();
    }

    /** Claims of a valid remember token, or null if it is invalid, expired or not a remember token. */
    public Claims parseRemember(String token) {
        try {
            Claims claims = parseAny(token);
            return REMEMBER.equals(claims.get("typ", String.class)) ? claims : null;
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    /** Short fingerprint of the password hash: changing/resetting the password invalidates remembered sessions. */
    public static String passwordTag(String passwordHash) {
        try {
            byte[] d = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(String.valueOf(passwordHash).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 6; i++) sb.append(String.format("%02x", d[i]));
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public Long extractUserId(String token) {
        try { return Long.parseLong(parse(token).getSubject()); }
        catch (JwtException | IllegalArgumentException e) { return null; }
    }

    public boolean isValid(String token) {
        try { parse(token); return true; }
        catch (JwtException | IllegalArgumentException e) { return false; }
    }
}
