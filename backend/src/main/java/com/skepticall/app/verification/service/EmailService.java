package com.skepticall.app.verification.service;

import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.exceptions.ErrorType;
import org.springframework.beans.factory.annotation.Value;
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

    @Value("${brevo.api.key}")
    private String apiKey;

    @Value("${brevo.sender.email}")
    private String senderEmail;

    @Value("${brevo.sender.name}")
    private String senderName;

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
        try {
            SendSmtpEmail email = new SendSmtpEmail();
            email.setSender(new SendSmtpEmailSender().email(senderEmail).name(senderName));
            email.setTo(List.of(new SendSmtpEmailTo().email(toEmail)));
            email.setSubject(subject);
            email.setHtmlContent(htmlBody + footer(unsubscribeUrl));
            getApi().sendTransacEmail(email);
        } catch (Exception e) {
            throw new BusinessException(
                    ErrorType.INVALID_OPERATION,
                    "Failed to send transactional email [to=" + toEmail + "] Reason: " + e.getMessage()
            );
        }
    }
}
