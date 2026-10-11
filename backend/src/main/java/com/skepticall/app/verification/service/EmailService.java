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
        try {
            SendSmtpEmail email = new SendSmtpEmail();
            email.setSender(new SendSmtpEmailSender().email(senderEmail).name(senderName));
            email.setTo(List.of(new SendSmtpEmailTo().email(toEmail)));
            email.setSubject(subject);
            email.setHtmlContent(htmlBody);
            getApi().sendTransacEmail(email);
        } catch (Exception e) {
            throw new BusinessException(
                    ErrorType.INVALID_OPERATION,
                    "Failed to send transactional email [to=" + toEmail + "] Reason: " + e.getMessage()
            );
        }
    }
}
