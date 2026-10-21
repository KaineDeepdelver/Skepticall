package com.skepticall.app.verification.service;

import com.skepticall.app.exceptions.BusinessException;
import jakarta.mail.BodyPart;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Properties;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Sending through any SMTP provider, from an address on your own domain. */
class EmailServiceTest {

    private EmailService service;
    private JavaMailSender mailSender;

    @BeforeEach
    void setUp() {
        mailSender = mock(JavaMailSender.class);
        when(mailSender.createMimeMessage()).thenAnswer(i -> new MimeMessage(Session.getInstance(new Properties())));

        service = new EmailService();
        ReflectionTestUtils.setField(service, "provider", "smtp");
        ReflectionTestUtils.setField(service, "senderEmail", "no-reply@example.org");
        ReflectionTestUtils.setField(service, "senderName", "Skepticall");
        ReflectionTestUtils.setField(service, "mailSender", mailSender);
        ReflectionTestUtils.setField(service, "legalName", "Jane Doe");
        ReflectionTestUtils.setField(service, "legalContact", "privacy@example.org");
        ReflectionTestUtils.setField(service, "legalAddress", "");
    }

    private MimeMessage sent() throws Exception {
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        MimeMessage message = captor.getValue();
        message.saveChanges();
        return message;
    }

    /** All text/plain and text/html content of a message, concatenated. */
    private static String allText(Part part) throws Exception {
        if (part.isMimeType("text/*")) return String.valueOf(part.getContent());
        StringBuilder sb = new StringBuilder();
        if (part.isMimeType("multipart/*")) {
            Multipart mp = (Multipart) part.getContent();
            for (int i = 0; i < mp.getCount(); i++) {
                BodyPart bp = mp.getBodyPart(i);
                sb.append(allText(bp)).append('\n');
            }
        }
        return sb.toString();
    }

    @Test
    void theMessageComesFromYourOwnAddress() throws Exception {
        service.sendCustomEmail("sam@example.com", "Hello", "<p>Hi</p>");

        MimeMessage m = sent();
        InternetAddress from = (InternetAddress) m.getFrom()[0];
        assertEquals("no-reply@example.org", from.getAddress());
        assertEquals("Skepticall", from.getPersonal());
        assertEquals("sam@example.com", m.getAllRecipients()[0].toString());
        assertEquals("Hello", m.getSubject());
    }

    @Test
    void itHasAnHtmlPartAndAPlainTextPartWithTheFooter() throws Exception {
        service.sendCustomEmail("sam@example.com", "Hello", "<h2>Verify</h2><p>Your code is <b>123456</b></p>");

        String text = allText(sent());
        assertTrue(text.contains("<b>123456</b>"));            // html part
        assertTrue(text.contains("Your code is 123456"));      // plain part
        assertTrue(text.contains("Jane Doe"));                 // footer: who sent it
        assertTrue(text.contains("privacy@example.org"));      // footer: how to reach them
        assertTrue(text.contains("can't be switched off"));    // security-email wording
    }

    @Test
    void linksSurviveInThePlainTextVersion() {
        String plain = EmailService.toPlainText("<p><a href=\"https://app.example/confirm?token=abc\">Delete my account</a></p>");

        assertTrue(plain.contains("Delete my account (https://app.example/confirm?token=abc)"));
        assertFalse(plain.contains("<"));
    }

    @Test
    void optionalEmailsCarryAnUnsubscribeLinkAndHeader() throws Exception {
        service.sendCustomEmail("sam@example.com", "New sign-in", "<p>New network</p>", "https://app.example/email-preferences?token=t");

        MimeMessage m = sent();
        assertEquals("<https://app.example/email-preferences?token=t>", m.getHeader("List-Unsubscribe")[0]);
        assertTrue(allText(m).contains("Turn off these emails"));
    }

    @Test
    void securityEmailsHaveNoUnsubscribeHeader() throws Exception {
        service.sendCustomEmail("sam@example.com", "Reset", "<p>Code</p>");

        assertNull(sent().getHeader("List-Unsubscribe"));
    }

    @Test
    void smtpWithoutAConfiguredServerFailsClearly() {
        ReflectionTestUtils.setField(service, "mailSender", null);

        BusinessException e = assertThrows(BusinessException.class, () -> service.sendCustomEmail("sam@example.com", "x", "<p>x</p>"));
        assertTrue(e.getMessage().contains("SPRING_MAIL_HOST"));
    }

    @Test
    void aMissingFromAddressFailsClearlyAndSendsNothing() throws Exception {
        ReflectionTestUtils.setField(service, "senderEmail", "");

        BusinessException e = assertThrows(BusinessException.class, () -> service.sendCustomEmail("sam@example.com", "x", "<p>x</p>"));
        assertTrue(e.getMessage().contains("MAIL_FROM_EMAIL"));
        verify(mailSender, never()).send(org.mockito.ArgumentMatchers.any(MimeMessage.class));
    }
}
