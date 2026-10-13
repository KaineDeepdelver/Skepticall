package com.skepticall.app.user.service;

import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.user.dto.PublicKeyDTO;
import com.skepticall.app.user.entity.User;
import com.skepticall.app.user.entity.UserPublicKey;
import com.skepticall.app.user.repository.UserPublicKeyRepository;
import com.skepticall.app.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Rerolling the public key: the new key takes over at once, the old one stays valid for
 * 30 days and then drops out. A small in-memory fake stands in for the key table.
 */
class PublicKeyServiceTest {

    private static final long USER_ID = 1L;
    private static final String PASSWORD = "pw";

    /** A clock the tests can move forward. */
    private static final class MutableClock extends Clock {
        private Instant instant = Instant.parse("2026-10-11T12:00:00Z");

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return instant; }
        void advance(Duration d) { instant = instant.plus(d); }
    }

    private final List<UserPublicKey> store = new ArrayList<>();
    private final MutableClock clock = new MutableClock();

    private UserRepository userRepository;
    private UserPublicKeyRepository keyRepository;
    private PublicKeyService service;
    private User user;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        keyRepository = mock(UserPublicKeyRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);

        user = new User();
        user.setPassword("hash");
        ReflectionTestUtils.setField(user, "id", USER_ID);

        when(encoder.matches(PASSWORD, "hash")).thenReturn(true);
        when(userRepository.findByIdForUpdate(USER_ID)).thenAnswer(i -> Optional.of(user));
        when(userRepository.findById(USER_ID)).thenAnswer(i -> Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        when(keyRepository.save(any(UserPublicKey.class))).thenAnswer(i -> {
            UserPublicKey k = i.getArgument(0);
            if (!store.contains(k)) store.add(k);
            return k;
        });
        when(keyRepository.findFirstByUserIdAndRetiredAtIsNullOrderByCreatedAtDesc(USER_ID))
                .thenAnswer(i -> store.stream().filter(k -> k.getRetiredAt() == null).findFirst());
        when(keyRepository.existsByUserIdAndPublicKey(eq(USER_ID), anyString()))
                .thenAnswer(i -> store.stream().anyMatch(k -> k.getPublicKey().equals(i.getArgument(1))));
        when(keyRepository.findValid(eq(USER_ID), any(LocalDateTime.class))).thenAnswer(i -> {
            LocalDateTime cutoff = i.getArgument(1);
            return store.stream()
                    .filter(k -> k.getRetiredAt() == null || k.getRetiredAt().isAfter(cutoff))
                    .sorted(Comparator.comparing(UserPublicKey::getActivatedAt).reversed()) // newest first, like the real query
                    .collect(Collectors.toList());
        });

        service = new PublicKeyService(userRepository, keyRepository, encoder);
        ReflectionTestUtils.setField(service, "graceDays", 30);
        ReflectionTestUtils.setField(service, "minIntervalMinutes", 60);
        ReflectionTestUtils.setField(service, "clock", clock);
    }

    // == helpers =================================================================

    private static String key(int seed) {
        byte[] raw = new byte[32];
        Arrays.fill(raw, (byte) seed);
        return Base64.getEncoder().encodeToString(raw);
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    /** An account whose current key has been in place for {@code ageHours}. */
    private void accountWithKey(String key, long ageHours) {
        user.setPublicKey(key);
        store.add(UserPublicKey.builder()
                .userId(USER_ID).publicKey(key).activatedAt(now().minusHours(ageHours)).build());
    }

    private UserPublicKey row(String key) {
        return store.stream().filter(k -> k.getPublicKey().equals(key)).findFirst().orElseThrow();
    }

    private List<String> validKeyStrings() {
        return service.validKeys(USER_ID).stream().map(PublicKeyDTO::getPublicKey).toList();
    }

    // == Rerolling ===============================================================

    @Test
    void firstKeyForAnAccountWithoutOneJustSetsIt() {
        service.rotate(USER_ID, key(1), PASSWORD);

        assertEquals(key(1), user.getPublicKey());
        assertEquals(1, store.size());
        assertNull(store.get(0).getRetiredAt());
    }

    @Test
    void rerollingMakesTheNewKeyCurrentAndRetiresTheOldOne() {
        accountWithKey(key(1), 2);

        List<PublicKeyDTO> result = service.rotate(USER_ID, key(2), PASSWORD);

        assertEquals(key(2), user.getPublicKey());
        assertNull(row(key(2)).getRetiredAt());
        assertEquals(now(), row(key(1)).getRetiredAt());
        assertEquals(List.of(key(2), key(1)), result.stream().map(PublicKeyDTO::getPublicKey).toList());
        assertTrue(result.get(0).isCurrent());
        assertFalse(result.get(1).isCurrent());
        assertEquals(now().plusDays(30), result.get(1).getExpiresAt());
    }

    @Test
    void theOldKeyStaysValidFor30DaysThenDropsOut() {
        accountWithKey(key(1), 2);
        service.rotate(USER_ID, key(2), PASSWORD);

        clock.advance(Duration.ofDays(29).plusHours(23));
        assertEquals(List.of(key(2), key(1)), validKeyStrings());

        clock.advance(Duration.ofHours(1)); // exactly 30 days after it was retired
        assertEquals(List.of(key(2)), validKeyStrings());
    }

    @Test
    void theCurrentKeyNeverExpires() {
        accountWithKey(key(1), 2);

        clock.advance(Duration.ofDays(400));

        assertEquals(List.of(key(1)), validKeyStrings());
    }

    @Test
    void cleanupDeletesKeysRetiredMoreThan30DaysAgo() {
        service.purgeExpired();

        ArgumentCaptor<LocalDateTime> cutoff = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(keyRepository).deleteExpired(cutoff.capture());
        assertEquals(now().minusDays(30), cutoff.getValue());
    }

    @Test
    void anAccountThatPredatesKeyHistoryHasItsKeyRecordedAndRetired() {
        user.setPublicKey(key(1)); // legacy: key only on the user row, no history rows

        service.rotate(USER_ID, key(2), PASSWORD);

        assertEquals(now(), row(key(1)).getRetiredAt());
        assertEquals(List.of(key(2), key(1)), validKeyStrings());
    }

    @Test
    void anAccountThatNeverRerolledStillReportsItsKey() {
        user.setPublicKey(key(1)); // no history rows

        List<PublicKeyDTO> keys = service.validKeys(USER_ID);

        assertEquals(1, keys.size());
        assertEquals(key(1), keys.get(0).getPublicKey());
        assertTrue(keys.get(0).isCurrent());
    }

    // == Refusals ================================================================

    @Test
    void wrongPasswordIsRefusedAndNothingChanges() {
        accountWithKey(key(1), 2);

        assertThrows(BusinessException.class, () -> service.rotate(USER_ID, key(2), "wrong"));

        assertEquals(key(1), user.getPublicKey());
        assertNull(row(key(1)).getRetiredAt());
        verify(keyRepository, never()).save(any(UserPublicKey.class));
    }

    @Test
    void rerollingToTheCurrentKeyIsRefused() {
        accountWithKey(key(1), 2);

        assertThrows(BusinessException.class, () -> service.rotate(USER_ID, key(1), PASSWORD));
    }

    @Test
    void aRetiredKeyCannotBeReused() {
        accountWithKey(key(1), 2);
        service.rotate(USER_ID, key(2), PASSWORD);
        clock.advance(Duration.ofHours(2));

        assertThrows(BusinessException.class, () -> service.rotate(USER_ID, key(1), PASSWORD));
        assertEquals(key(2), user.getPublicKey());
    }

    @Test
    void rerollingTwiceInARowIsRateLimited() {
        accountWithKey(key(1), 2);
        service.rotate(USER_ID, key(2), PASSWORD);

        clock.advance(Duration.ofMinutes(10));
        assertThrows(BusinessException.class, () -> service.rotate(USER_ID, key(3), PASSWORD));

        clock.advance(Duration.ofMinutes(51)); // 61 minutes after the first reroll
        service.rotate(USER_ID, key(3), PASSWORD);
        assertEquals(key(3), user.getPublicKey());
        assertEquals(List.of(key(3), key(2), key(1)), validKeyStrings());
    }

    @Test
    void malformedKeysAreRefused() {
        accountWithKey(key(1), 2);
        String shortKey = Base64.getEncoder().encodeToString(new byte[16]);
        String zeroKey = Base64.getEncoder().encodeToString(new byte[32]);

        for (String bad : new String[]{null, "", "   ", "not base64 !!", shortKey, zeroKey}) {
            assertThrows(BusinessException.class, () -> service.rotate(USER_ID, bad, PASSWORD), "key: " + bad);
        }
        assertEquals(key(1), user.getPublicKey());
    }

    // == Key format ==============================================================

    @Test
    void urlSafeBase64IsAcceptedAndStoredInStandardForm() {
        byte[] raw = new byte[32];
        Arrays.fill(raw, (byte) 0xfb); // encodes with '+' and '/' in standard base64
        String standard = Base64.getEncoder().encodeToString(raw);
        String urlSafe = Base64.getUrlEncoder().encodeToString(raw);

        assertNotEquals(standard, urlSafe);
        assertEquals(standard, PublicKeyService.canonicalize(urlSafe));
        assertEquals(standard, PublicKeyService.canonicalize(standard));
    }
}
