package com.skepticall.app.verification.service;

import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.exceptions.ErrorType;
import jakarta.annotation.PostConstruct;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import sendinblue.ApiClient;
import sendinblue.Configuration;
import sendinblue.auth.ApiKeyAuth;
import sibApi.TransactionalEmailsApi;
import sibModel.SendSmtpEmail;
import sibModel.SendSmtpEmailSender;
import sibModel.SendSmtpEmailTo;

import java.util.List;

@Service
public class EmailService {

    private static final Logger LOG = LoggerFactory.getLogger(EmailService.class);

    /** "smtp" (any provider that speaks SMTP) or "brevo" (Brevo's HTTP API). Env MAIL_PROVIDER. */
    @Value("${mail.provider:brevo}")
    private String provider;

    @Value("${brevo.api.key:}")
    private String apiKey;

    /** The From address. Use an address on YOUR domain, and authenticate that domain with the provider. */
    @Value("${mail.from.email:${brevo.sender.email:}}")
    private String senderEmail;

    @Value("${mail.from.name:${brevo.sender.name:Skepticall}}")
    private String senderName;

    /** Present only when an SMTP server is configured (SPRING_MAIL_HOST and friends). */
    @Autowired(required = false)
    private JavaMailSender mailSender;

    @PostConstruct
    void checkConfiguration() {
        if (usesSmtp()) {
            if (mailSender == null) LOG.warn("[email] MAIL_PROVIDER=smtp but no SMTP server is configured (set SPRING_MAIL_HOST); emails will fail");
        } else if (apiKey == null || apiKey.isBlank()) {
            LOG.warn("[email] MAIL_PROVIDER=brevo but BREVO_API_KEY is empty; emails will fail");
        }
        if (senderEmail == null || senderEmail.isBlank()) LOG.warn("[email] no From address configured (set MAIL_FROM_EMAIL)");
    }

    private boolean usesSmtp() {
        return "smtp".equalsIgnoreCase(provider == null ? "" : provider.trim());
    }

    // == Internal =============================================================

    private TransactionalEmailsApi getApi() {
        ApiClient client = Configuration.getDefaultApiClient();
        ApiKeyAuth auth = (ApiKeyAuth) client.getAuthentication("api-key");
        auth.setApiKey(apiKey);
        return new TransactionalEmailsApi(client);
    }

    // == Send =================================================================

    public void sendVerificationCode(String toEmail,
                                     String verificationCode,
                                     boolean isForgotPassword) {
        try {
            String subject = isForgotPassword
                    ? "Reset your Skepticall password"
                    : "Verify your Skepticall account";

            String body = isForgotPassword
                    ? "<h2>Password Reset</h2><p>Your reset code is: <strong>" + verificationCode + "</strong></p><p>Expires in 10 minutes.</p>"
                    : "<h2>Welcome to Skepticall!</h2><p>Your verification code is: <strong>" + verificationCode + "</strong></p><p>Expires in 10 minutes.</p>";

            sendCustomEmail(toEmail, subject, body);
        } catch (Exception e) {
            throw new BusinessException(
                    ErrorType.INVALID_OPERATION,
                    "Failed to send email for verification code: " + e.getMessage()
            );
        }
    }

    /**
     * Generic email sender — used for IP login alerts and other transactional emails.
     */
    public void sendCustomEmail(String toEmail, String subject, String htmlBody) {
        sendCustomEmail(toEmail, subject, htmlBody, null);
    }

    @org.springframework.beans.factory.annotation.Value("${legal.business-name:}")
    private String legalName;

    @org.springframework.beans.factory.annotation.Value("${legal.contact-email:}")
    private String legalContact;

    @org.springframework.beans.factory.annotation.Value("${legal.business-address:}")
    private String legalAddress;

    /**
     * Standard footer: why you got this, who sent it and how to reach them, and (for optional
     * emails only) a link to stop them. Account-security emails (verification codes, password
     * resets) can't be switched off, and the footer says so.
     */
    String footer(String unsubscribeUrl) {
        StringBuilder sb = new StringBuilder("<hr style=\"border:none;border-top:1px solid #ddd;margin:24px 0\"/>");
        sb.append("<p style=\"font-size:12px;color:#777\">");
        if (unsubscribeUrl != null) {
            sb.append("You're getting this email because you turned on this alert in your Skepticall settings. ")
              .append("<a href=\"").append(unsubscribeUrl).append("\">Turn off these emails</a>.");
        } else {
            sb.append("You're getting this email because of activity on a Skepticall account that uses this address ")
              .append("(for example signing up or resetting a password). It's a security message, so it can't be switched off. ")
              .append("If this wasn't you, you can ignore it.");
        }
        sb.append("<br/>").append(legalName == null || legalName.isBlank() ? "Skepticall" : legalName);
        if (legalAddress != null && !legalAddress.isBlank()) sb.append(", ").append(legalAddress);
        if (legalContact != null && !legalContact.isBlank()) sb.append(" · ").append(legalContact);
        return sb.append("</p>").toString();
    }

    /** As above, with a one-click "turn off these emails" link in the footer (for optional emails). */
    public void sendCustomEmail(String toEmail, String subject, String htmlBody, String unsubscribeUrl) {
        String html = htmlBody + footer(unsubscribeUrl);
        try {
            if (usesSmtp()) {
                sendViaSmtp(toEmail, subject, html, unsubscribeUrl);
            } else {
                sendViaBrevo(toEmail, subject, html);
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(
                    ErrorType.INVALID_OPERATION,
                    "Failed to send transactional email [to=" + toEmail + "] Reason: " + e.getMessage()
            );
        }
    }

    // == Transports ============================================================

    private void sendViaBrevo(String toEmail, String subject, String html) throws Exception {
        SendSmtpEmail email = new SendSmtpEmail();
        email.setSender(new SendSmtpEmailSender().email(senderEmail).name(senderName));
        email.setTo(List.of(new SendSmtpEmailTo().email(toEmail)));
        email.setSubject(subject);
        email.setHtmlContent(html);
        getApi().sendTransacEmail(email);
    }

    private void sendViaSmtp(String toEmail, String subject, String html, String unsubscribeUrl) throws Exception {
        if (mailSender == null) {
            throw new BusinessException(ErrorType.INVALID_OPERATION,
                    "Email is set to SMTP but no SMTP server is configured (set SPRING_MAIL_HOST)");
        }
        if (senderEmail == null || senderEmail.isBlank()) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "No From address is configured (set MAIL_FROM_EMAIL)");
        }
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(senderEmail, senderName == null || senderName.isBlank() ? "Skepticall" : senderName);
        helper.setTo(toEmail);
        helper.setSubject(subject);
        helper.setText(toPlainText(html), html); // plain-text part too: mail filters like a real alternative
        if (unsubscribeUrl != null) {
            message.addHeader("List-Unsubscribe", "<" + unsubscribeUrl + ">");
        }
        mailSender.send(message);
    }

    /** A readable plain-text version of the HTML body (links kept as "text (url)"). */
    static String toPlainText(String html) {
        return html
                .replaceAll("(?is)<a\\s+[^>]*href=\"([^\"]+)\"[^>]*>(.*?)</a>", "$2 ($1)")
                .replaceAll("(?i)<br\\s*/?>|</p>|</h[1-6]>|</li>|<hr[^>]*>", "\n")
                .replaceAll("<[^>]+>", "")
                .replace("&nbsp;", " ")
                .replaceAll("\n{3,}", "\n\n")
                .trim();
    }
}
