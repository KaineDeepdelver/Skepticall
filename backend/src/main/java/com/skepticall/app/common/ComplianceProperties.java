package com.skepticall.app.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Legal / compliance settings, all overridable with environment variables. */
@Component
public class ComplianceProperties {

    /** Refuse sign-ups that don't tick the terms and age boxes (env REQUIRE_SIGNUP_CONSENT). */
    @Value("${compliance.require-consent:true}")
    private boolean requireConsent;

    /** Recorded next to each account's consent, so you know which text they accepted (env TERMS_VERSION). */
    @Value("${compliance.terms-version:2026-10}")
    private String termsVersion;

    /** Minimum age (env MIN_AGE). 16 covers the strictest GDPR default; some countries allow 13. */
    @Value("${compliance.min-age:16}")
    private int minAge;

    /** Public address of the web app, used in links inside emails (env FRONTEND_URL). */
    @Value("${compliance.frontend-url:}")
    private String frontendUrl;

    @Value("${app.cors.allowed-origins:http://localhost:3000}")
    private String allowedOrigins;

    @Value("${legal.business-name:}")
    private String businessName;

    @Value("${legal.contact-email:}")
    private String contactEmail;

    @Value("${legal.business-address:}")
    private String businessAddress;

    public boolean isRequireConsent() { return requireConsent; }
    public String getTermsVersion() { return termsVersion; }
    public int getMinAge() { return minAge; }
    public String getBusinessName() { return businessName; }
    public String getContactEmail() { return contactEmail; }
    public String getBusinessAddress() { return businessAddress; }

    /** The web app's base URL without a trailing slash: FRONTEND_URL, or the first allowed origin. */
    public String frontendBaseUrl() {
        String base = frontendUrl != null && !frontendUrl.isBlank() ? frontendUrl : firstOrigin();
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    private String firstOrigin() {
        for (String o : allowedOrigins.split(",")) {
            if (!o.isBlank()) return o.trim();
        }
        return "http://localhost:3000";
    }
}
