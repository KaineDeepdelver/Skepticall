package com.skepticall.app.verification.service;

import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.user.entity.User;
import com.skepticall.app.user.repository.UserRepository;
import com.skepticall.app.verification.entity.VerificationCode;
import com.skepticall.app.verification.entity.VerificationCode.CodeType;
import com.skepticall.app.verification.repository.VerificationCodeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Sign-up and password-reset codes: what is allowed, and what an attacker can't do. */
class VerificationServiceTest {

    private static final String EMAIL = "sam@example.com";

    private VerificationCodeRepository codes;
    private EmailService emailService;
    private UserRepository users;
    private VerificationService service;

    @BeforeEach
    void setUp() {
        codes = mock(VerificationCodeRepository.class);
        emailService = mock(EmailService.class);
        users = mock(UserRepository.class);
        VerificationService real = new VerificationService(codes, emailService, users);
        ReflectionTestUtils.setField(real, "requireRegistrationVerification", true);
        service = spy(real);
        doReturn(true).when(service).isValidEmailDomain(anyString()); // no real DNS lookups in tests
    }

    private VerificationCode stored(String code, CodeType type, LocalDateTime expiresAt, int attempts) {
        VerificationCode vc = VerificationCode.builder().email(EMAIL).code(code).type(type)
                .expiresAt(expiresAt).used(false).attempts(attempts).build();
        when(codes.findLatestCode(EMAIL, type)).thenReturn(Optional.of(vc));
        return vc;
    }

    // == Sending ==================================================================

    @Test
    void aSixDigitCodeIsCreatedAndEmailed() {
        service.sendRegistrationCode(EMAIL);

        ArgumentCaptor<VerificationCode> saved = ArgumentCaptor.forClass(VerificationCode.class);
        verify(codes).save(saved.capture());
        VerificationCode vc = saved.getValue();
        assertTrue(vc.getCode().matches("\\d{6}"));
        assertEquals(0, vc.getAttempts());
        assertFalse(vc.isUsed());
        assertEquals(CodeType.REGISTRATION, vc.getType());
        assertTrue(vc.getExpiresAt().isAfter(LocalDateTime.now().plusMinutes(9)));
        verify(emailService).sendVerificationCode(EMAIL, vc.getCode(), false);
    }

    @Test
    void aSecondCodeCannotBeRequestedStraightAway() {
        stored("111111", CodeType.REGISTRATION, LocalDateTime.now().plusSeconds(570), 0); // sent 30 seconds ago

        assertThrows(BusinessException.class, () -> service.sendRegistrationCode(EMAIL));

        verify(codes, never()).save(any());
        verify(emailService, never()).sendVerificationCode(anyString(), anyString(), anyBoolean());
    }

    @Test
    void aNewCodeIsAllowedAfterTheCooldownAndReplacesTheOldOne() {
        stored("111111", CodeType.REGISTRATION, LocalDateTime.now().plusMinutes(8), 3); // sent 2 minutes ago

        service.sendRegistrationCode(EMAIL);

        verify(codes).deleteAllByEmail(EMAIL);
        verify(codes).save(any(VerificationCode.class));
    }

    @Test
    void anAddressWithNoMailServerIsRefused() {
        doReturn(false).when(service).isValidEmailDomain(anyString());

        assertThrows(BusinessException.class, () -> service.sendRegistrationCode("a@no-such-domain.invalid"));
        verify(emailService, never()).sendVerificationCode(anyString(), anyString(), anyBoolean());
    }

    @Test
    void passwordResetEmailsOnlyGoToRealAccountsAndTheFormDoesNotSayWhich() {
        when(users.findByEmail("nobody@example.com")).thenReturn(Optional.empty());
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(new User()));

        assertDoesNotThrow(() -> service.sendForgotPasswordCode("nobody@example.com")); // same answer as a real account
        verify(emailService, never()).sendVerificationCode(eq("nobody@example.com"), anyString(), anyBoolean());

        service.sendForgotPasswordCode(EMAIL);
        verify(emailService).sendVerificationCode(eq(EMAIL), anyString(), eq(true));
    }

    // == Checking =================================================================

    @Test
    void theRightCodeIsAccepted() {
        VerificationCode vc = stored("123456", CodeType.FORGOT_PASSWORD, LocalDateTime.now().plusMinutes(5), 0);

        assertTrue(service.verifyCode(EMAIL, " 123456 ", CodeType.FORGOT_PASSWORD)); // stray spaces are fine
        assertTrue(vc.isUsed());
    }

    @Test
    void aVerifiedSignUpCodeStaysValidLongEnoughToFinishTheForm() {
        VerificationCode vc = stored("123456", CodeType.REGISTRATION, LocalDateTime.now().plusMinutes(1), 0);

        service.verifyCode(EMAIL, "123456", CodeType.REGISTRATION);

        assertTrue(vc.getExpiresAt().isAfter(LocalDateTime.now().plusMinutes(25)));
    }

    @Test
    void aWrongGuessIsCountedAndSaved() {
        VerificationCode vc = stored("123456", CodeType.FORGOT_PASSWORD, LocalDateTime.now().plusMinutes(5), 0);

        assertThrows(BusinessException.class, () -> service.verifyCode(EMAIL, "000000", CodeType.FORGOT_PASSWORD));

        assertEquals(1, vc.getAttempts());
        verify(codes).save(vc);
        assertFalse(vc.isUsed());
    }

    @Test
    void afterFiveWrongGuessesEvenTheRightCodeIsRefused() {
        VerificationCode vc = stored("123456", CodeType.FORGOT_PASSWORD, LocalDateTime.now().plusMinutes(5), 0);
        for (int i = 0; i < VerificationService.MAX_ATTEMPTS; i++) {
            assertThrows(BusinessException.class, () -> service.verifyCode(EMAIL, "000000", CodeType.FORGOT_PASSWORD));
        }

        BusinessException e = assertThrows(BusinessException.class, () -> service.verifyCode(EMAIL, "123456", CodeType.FORGOT_PASSWORD));

        assertTrue(e.getMessage().toLowerCase().contains("too many"));
        assertFalse(vc.isUsed());
        assertEquals(VerificationService.MAX_ATTEMPTS, vc.getAttempts());
    }

    @Test
    void anExpiredCodeIsRefused() {
        stored("123456", CodeType.FORGOT_PASSWORD, LocalDateTime.now().minusSeconds(1), 0);

        assertThrows(BusinessException.class, () -> service.verifyCode(EMAIL, "123456", CodeType.FORGOT_PASSWORD));
    }

    @Test
    void noCodeAtAllIsRefused() {
        assertThrows(BusinessException.class, () -> service.verifyCode(EMAIL, "123456", CodeType.REGISTRATION));
    }

    // == Registration needs a verified email =====================================

    @Test
    void registrationWithoutAVerifiedEmailIsRefused() {
        when(codes.findVerified(eq(EMAIL), eq(CodeType.REGISTRATION), any(LocalDateTime.class))).thenReturn(Optional.empty());

        assertThrows(BusinessException.class, () -> service.requireVerifiedRegistration(EMAIL));
        assertThrows(BusinessException.class, () -> service.requireVerifiedRegistration(null));
    }

    @Test
    void registrationWithAVerifiedEmailIsAllowed() {
        when(codes.findVerified(eq(EMAIL), eq(CodeType.REGISTRATION), any(LocalDateTime.class)))
                .thenReturn(Optional.of(new VerificationCode()));

        assertDoesNotThrow(() -> service.requireVerifiedRegistration(EMAIL));
    }

    @Test
    void theCheckCanBeSwitchedOffForLocalTesting() {
        ReflectionTestUtils.setField(service, "requireRegistrationVerification", false);

        assertDoesNotThrow(() -> service.requireVerifiedRegistration(EMAIL));
        verify(codes, never()).findVerified(anyString(), any(), any());
    }

    @Test
    void theCodeIsForgottenOnceTheAccountExists() {
        service.consumeRegistration(EMAIL);

        verify(codes).deleteAllByEmail(EMAIL);
    }
}
