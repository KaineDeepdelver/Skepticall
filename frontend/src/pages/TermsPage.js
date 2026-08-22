import React from 'react';
import { useNavigate } from 'react-router-dom';

// == TERMS OF SERVICE PAGE ==

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="legal-page">
      <div className="legal-card">
        <button className="legal-back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>

        <h1 className="legal-title">Terms of Service</h1>
        <p className="legal-updated">Last updated: June 2025</p>

        <div className="legal-body">

          <h2>1. Acceptance of Terms</h2>
          <p>By creating an account or using Skepticall ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>

          <h2>2. Your Account</h2>
          <p>You are responsible for maintaining the confidentiality of your credentials. You agree to provide accurate information when registering and to keep it up to date. You may not impersonate any person or entity, or misrepresent your affiliation with any person or entity.</p>

          <h2>3. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Post unlawful, harassing, defamatory, or obscene content.</li>
            <li>Distribute spam, malware, or unsolicited bulk messages.</li>
            <li>Attempt to gain unauthorised access to any system or account.</li>
            <li>Scrape or harvest user data without explicit permission.</li>
            <li>Violate any applicable local, national, or international law.</li>
          </ul>

          <h2>4. Content Ownership</h2>
          <p>You retain ownership of content you post. By posting content, you grant Skepticall a non-exclusive, royalty-free licence to display and distribute that content in connection with the Service.</p>

          <h2>5. Privacy</h2>
          <p>Your use of the Service is also governed by our <a href="/privacy-policy" style={{ color: 'var(--accent)' }}>Privacy Policy</a>, which is incorporated into these Terms by reference.</p>

          <h2>6. Termination</h2>
          <p>We reserve the right to suspend or terminate your account at any time for violations of these Terms or for any other reason at our discretion. You may delete your account at any time from the Settings page.</p>

          <h2>7. Disclaimers</h2>
          <p>The Service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free operation.</p>

          <h2>8. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, Skepticall shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>

          <h2>9. Changes to Terms</h2>
          <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated Terms.</p>

          <h2>10. Contact</h2>
          <p>Questions about these Terms? Contact us via the Settings page or through our support channels.</p>

        </div>
      </div>
    </div>
  );
}
