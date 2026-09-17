import React from 'react';
import { useNavigate } from 'react-router-dom';

// == PRIVACY POLICY PAGE ==

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="legal-page">
      <div className="legal-card">
        <button className="legal-back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>

        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-updated">Last updated: June 2025</p>

        <div className="legal-body">

          <h2>1. Information We Collect</h2>
          <p>We collect information you provide directly, such as your username, email address, profile picture, and any content you post or send. We also collect certain technical data automatically, including IP addresses, device type, and usage patterns.</p>

          <h2>2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Operate and improve the Service.</li>
            <li>Deliver messages and notifications.</li>
            <li>Detect and prevent abuse, spam, and fraudulent activity.</li>
            <li>Send transactional emails (e.g. email verification, password reset).</li>
          </ul>

          <h2>3. Data Storage</h2>
          <p>Your data is stored on secure servers. Uploaded media files are stored locally on our infrastructure. We do not sell your personal data to third parties.</p>

          <h2>4. Cookies and Session Data</h2>
          <p>We use session storage to keep you signed in during your browsing session. No persistent tracking cookies are used beyond what is necessary for authentication.</p>

          <h2>5. IP Addresses</h2>
          <p>We log IP addresses at sign-in for security purposes. If you enable IP Login Alerts in Settings, we will email you when a sign-in occurs from a new IP address. IP data is not shared with third parties.</p>

          <h2>6. Third-Party Services</h2>
          <p>We use Brevo for transactional email delivery. Messages sent via Brevo are processed in accordance with their own privacy policy. No content of your private messages is shared with email providers.</p>

          <h2>7. Data Retention</h2>
          <p>Your data is retained as long as your account is active. When you delete your account, all associated data — including posts, messages, and media — is permanently removed from our servers.</p>

          <h2>8. Your Rights</h2>
          <p>You may access, correct, or delete your personal data at any time through the Settings page. To request a full data export, contact us through our support channels.</p>

          <h2>9. Children's Privacy</h2>
          <p>The Service is not intended for users under the age of 13. We do not knowingly collect data from children.</p>

          <h2>10. Changes to This Policy</h2>
          <p>We may update this Privacy Policy periodically. We will notify you of significant changes through the Service. Continued use constitutes acceptance of the updated policy.</p>

          <h2>11. Contact</h2>
          <p>Privacy questions or requests? Contact us via the Settings page or through our support channels.</p>

        </div>
      </div>
    </div>
  );
}
