package com.skepticall.app.privacy;

import com.skepticall.app.common.ComplianceProperties;
import com.skepticall.app.config.jwt.JwtUtil;
import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.user.entity.User;
import com.skepticall.app.user.repository.UserRepository;
import com.skepticall.app.verification.service.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Delete-my-data and stop-these-emails links that work without being logged in. */
class PrivacyServiceTest {

    private static final String SECRET = "unit-test-secret-unit-test-secret-0123456789";

    private UserRepository userRepository;
    private EmailService emailService;
    private AccountErasureService erasure;
    private StringRedisTemplate redis;
    private ValueOperations<String, String> valueOps;
    private JwtUtil jwt;
    private PrivacyService service;
    private User user;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        emailService = mock(EmailService.class);
        erasure = mock(AccountErasureService.class);
        redis = mock(StringRedisTemplate.class);
        valueOps = mock(ValueOperations.class);
        jwt = new JwtUtil(SECRET, 60_000L);
        ComplianceProperties compliance = mock(ComplianceProperties.class);
        when(compliance.frontendBaseUrl()).thenReturn("https://app.example");

        user = new User();
        user.setEmail("sam@example.com");
        user.setPassword("hash-1");
        user.setIpLoginAlerts(true);
        ReflectionTestUtils.setField(user, "id", 5L);

        when(userRepository.findByEmail("sam@example.com")).thenReturn(Optional.of(user));
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);
        when(erasure.erase(5L)).thenReturn(List.of("https://files/a.png"));

        service = new PrivacyService(userRepository, jwt, emailService, erasure, compliance, redis);
    }

    private String tokenFor(String purpose, String passwordHash) {
        return jwt.generatePurpose(5L, purpose, JwtUtil.passwordTag(passwordHash), 60_000L);
    }

    // == Asking for deletion ======================================================

    @Test
    void anExistingAccountGetsAnEmailWithAConfirmationLink() {
        service.requestDeletion("sam@example.com");

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendCustomEmail(eq("sam@example.com"), anyString(), body.capture());
        assertTrue(body.getValue().contains("https://app.example/data-deletion/confirm?token="));
        assertFalse(body.getValue().contains("hash-1"));
    }

    @Test
    void anUnknownAddressGetsNothingAndNoError() {
        assertDoesNotThrow(() -> service.requestDeletion("nobody@example.com"));

        verify(emailService, never()).sendCustomEmail(anyString(), anyString(), anyString());
    }

    @Test
    void repeatedRequestsAreRateLimited() {
        when(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(false);

        service.requestDeletion("sam@example.com");

        verify(emailService, never()).sendCustomEmail(anyString(), anyString(), anyString());
    }

    @Test
    void blankInputIsIgnored() {
        assertDoesNotThrow(() -> service.requestDeletion("  "));
        assertDoesNotThrow(() -> service.requestDeletion(null));
        verify(emailService, never()).sendCustomEmail(anyString(), anyString(), anyString());
    }

    // == Confirming deletion ======================================================

    @Test
    void aValidLinkErasesTheAccountAndItsFiles() {
        service.confirmDeletion(tokenFor(JwtUtil.PURPOSE_DELETE_ACCOUNT, "hash-1"));

        verify(erasure).erase(5L);
        verify(erasure).deleteFiles(List.of("https://files/a.png"));
    }

    @Test
    void aLinkMadeForAnotherPurposeIsRefused() {
        String unsubscribeToken = tokenFor(JwtUtil.PURPOSE_ALERTS_OFF, "hash-1");

        assertThrows(BusinessException.class, () -> service.confirmDeletion(unsubscribeToken));
        verify(erasure, never()).erase(any());
    }

    @Test
    void anAccessTokenCannotDeleteAnAccount() {
        String access = jwt.generate(5L, false);

        assertThrows(BusinessException.class, () -> service.confirmDeletion(access));
        verify(erasure, never()).erase(any());
    }

    @Test
    void aLinkStopsWorkingAfterThePasswordChanges() {
        String token = tokenFor(JwtUtil.PURPOSE_DELETE_ACCOUNT, "hash-1");
        user.setPassword("hash-2"); // password reset after the email was sent

        assertThrows(BusinessException.class, () -> service.confirmDeletion(token));
        verify(erasure, never()).erase(any());
    }

    @Test
    void garbageAndMissingTokensAreRefused() {
        assertThrows(BusinessException.class, () -> service.confirmDeletion("not-a-token"));
        assertThrows(BusinessException.class, () -> service.confirmDeletion(null));
    }

    @Test
    void anExpiredLinkIsRefused() {
        String expired = jwt.generatePurpose(5L, JwtUtil.PURPOSE_DELETE_ACCOUNT, JwtUtil.passwordTag("hash-1"), -1000L);

        assertThrows(BusinessException.class, () -> service.confirmDeletion(expired));
    }

    // == Stopping optional emails =================================================

    @Test
    void theUnsubscribeLinkTurnsTheAlertsOff() {
        service.unsubscribeAlerts(tokenFor(JwtUtil.PURPOSE_ALERTS_OFF, "hash-1"));

        assertFalse(user.isIpLoginAlerts());
        verify(userRepository).save(user);
    }

    @Test
    void theUnsubscribeLinkCannotBeUsedToDeleteAnything() {
        String token = tokenFor(JwtUtil.PURPOSE_ALERTS_OFF, "hash-1");

        assertThrows(BusinessException.class, () -> service.confirmDeletion(token));
    }
}
