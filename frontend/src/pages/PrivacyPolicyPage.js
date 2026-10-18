import React from 'react';
import { Link } from 'react-router-dom';
import LegalLayout from '../legal/LegalLayout';
import { MIN_AGE, business, operatorName } from '../config/business';

/*
 * Written from what the code actually does (see docs/COMPLIANCE.md). If you change how data is
 * handled (a new provider, a new retention period), change this page and bump TERMS_VERSION.
 */
export default function PrivacyPolicyPage() {
  const contact = business.email
    ? <a href={`mailto:${business.email}`}>{business.email}</a>
    : <>the contact details at the bottom of this page</>;

  return (
    <LegalLayout title="Privacy Policy">
      <p>
        This policy explains what personal data {operatorName} (“we”) handles when you use Skepticall, why, who else sees
        it, how long we keep it and what you can do about it. The short version: your messages are end-to-end encrypted so
        we can’t read them, we keep little else, and we don’t advertise, track you or sell data.
      </p>

      <h2>1. Who is responsible</h2>
      <p>{operatorName} is the controller of your personal data. Contact: {contact}. Our details are listed at the bottom of this page.</p>

      <h2>2. What we collect and why</h2>
      <div className="lg-table-wrap">
        <table className="lg-table">
          <thead><tr><th>Data</th><th>Why we need it</th><th>Legal basis</th></tr></thead>
          <tbody>
            <tr><td>Username, email address, display name, password (stored only as a salted hash)</td><td>To create and secure your account, send you verification codes and password resets</td><td>Contract</td></tr>
            <tr><td>Your public encryption key</td><td>So other people’s apps can encrypt messages to you. (Your private key never leaves your devices.)</td><td>Contract</td></tr>
            <tr><td>When you accepted the Terms and confirmed your age, and which version of the Terms</td><td>To show we had your agreement and that you meet the minimum age</td><td>Legal obligation / legitimate interests</td></tr>
            <tr><td>Profile details you choose to add (picture, banner, bio)</td><td>To show your profile to others as you set it up</td><td>Contract</td></tr>
            <tr><td>Messages and files you send</td><td>To deliver them. The content is end-to-end encrypted; we hold the encrypted data and its routing details (sender, recipient, time, type, size) only while delivering it. See “How long we keep data”.</td><td>Contract</td></tr>
            <tr><td>Calls: who called whom, when, for how long</td><td>To show your call history and make calls work</td><td>Contract</td></tr>
            <tr><td>Friends, friend requests, groups you belong to, notifications</td><td>To run the social features you use</td><td>Contract</td></tr>
            <tr><td>Time of your last sign-in and the network it came from (your IP address with its last part removed)</td><td>To notice sign-ins from somewhere new and, if you turn it on, email you about them</td><td>Legitimate interests (account security)</td></tr>
            <tr><td>Whether you are online (unless you choose “Appear offline”)</td><td>To show your status to others</td><td>Contract</td></tr>
            <tr><td>Technical logs kept by our hosting providers (which can include IP addresses)</td><td>To keep the service secure and running</td><td>Legitimate interests</td></tr>
            <tr><td>Google reCAPTCHA data (only if you allow it on the sign-up form)</td><td>To block automated sign-ups</td><td>Consent</td></tr>
          </tbody>
        </table>
      </div>

      <h2>3. What we don’t do</h2>
      <ul>
        <li>We don’t show ads, use advertising or analytics cookies, or build profiles about you.</li>
        <li>We don’t sell or rent your data.</li>
        <li>We don’t load fonts or icons from third parties: they are served from our own site.</li>
        <li>We can’t read your messages, and we don’t scan them.</li>
      </ul>

      <h2>4. How your messages are protected</h2>
      <p>
        Messages and files are encrypted on your device before they are sent, using a key pair that belongs to your account.
        Only you and the people you’re talking to can decrypt them. We can’t, and neither can anyone who gains access to our servers.
        The server still sees <em>metadata</em>: who talks to whom, when, the type and size of a message, and call logs.
      </p>
      <p>
        Because we can’t read your messages we also can’t recover them. Your encryption key lives on your device. If you lose it
        you lose access to your old messages, so download a key backup (Settings → Security) and keep it somewhere safe.
      </p>

      <h2>5. Who else handles your data</h2>
      <p>We use these service providers (“processors”) and only for the purposes below:</p>
      <div className="lg-table-wrap">
        <table className="lg-table">
          <thead><tr><th>Provider</th><th>What for</th></tr></thead>
          <tbody>
            <tr><td>Render</td><td>Runs our servers</td></tr>
            <tr><td>Neon</td><td>Hosts our database</td></tr>
            <tr><td>Cloudflare</td><td>Hosts this website; stores uploaded files (encrypted)</td></tr>
            <tr><td>Brevo</td><td>Sends our emails (verification codes, password resets, optional sign-in alerts)</td></tr>
            <tr><td>Metered</td><td>Relays calls when two devices can’t connect directly. It sees IP addresses and encrypted call traffic</td></tr>
            <tr><td>Google (reCAPTCHA)</td><td>Spam protection on sign-up, only if you allow it</td></tr>
            <tr><td>Expo</td><td>Delivers push notifications to the mobile app</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Some of these providers process data outside your country, including outside the EU/EEA and the UK. Where that happens
        we rely on the safeguards the law provides, such as standard contractual clauses. We may disclose data if the law requires it.
      </p>

      <h2>6. How long we keep data</h2>
      <div className="lg-table-wrap">
        <table className="lg-table">
          <thead><tr><th>Data</th><th>Kept for</th></tr></thead>
          <tbody>
            <tr><td>Messages and files (encrypted)</td><td>Deleted a few minutes after your device confirms delivery. Anything never collected is deleted after 30 days at the latest.</td></tr>
            <tr><td>Call history</td><td>30 days</td></tr>
            <tr><td>Previous encryption keys after you replace your key</td><td>30 days, so messages sent to the old key still open</td></tr>
            <tr><td>Account, profile, friends, groups, notifications</td><td>Until you delete your account</td></tr>
            <tr><td>Last sign-in time and network</td><td>Until your next sign-in replaces it, or you delete your account</td></tr>
            <tr><td>Consent record</td><td>Until you delete your account</td></tr>
            <tr><td>Provider logs and backups</td><td>According to each provider’s schedule; deleted data can remain in backups until they rotate out</td></tr>
          </tbody>
        </table>
      </div>

      <h2>7. Your rights</h2>
      <p>Depending on where you live (for example under the GDPR or UK GDPR) you can:</p>
      <ul>
        <li><strong>Access and receive a copy</strong> of your data: contact us at {contact}.</li>
        <li><strong>Correct</strong> your data: change your profile and email in Settings.</li>
        <li><strong>Delete</strong> your data: Settings → Delete account, or <Link to="/data-deletion">ask us here</Link> if you can’t sign in.</li>
        <li><strong>Object to or restrict</strong> how we use it, or <strong>withdraw consent</strong> at any time (for cookies, use “Cookie settings”).</li>
        <li><strong>Complain</strong> to your data protection authority.</li>
      </ul>
      <p>We reply within one month. We’ll never charge you for exercising these rights.</p>

      <h2>8. Children</h2>
      <p>
        Skepticall is for people aged {MIN_AGE} and over, and we ask you to confirm your age when you sign up. We don’t knowingly
        collect data from younger children. If we learn that an account belongs to someone under {MIN_AGE} we will delete it.
        If you think this has happened, please contact us.
      </p>

      <h2>9. Cookies and similar technologies</h2>
      <p>See our <Link to="/cookie-policy">Cookie Policy</Link> for the full list of what is stored in your browser.</p>

      <h2>10. Emails</h2>
      <p>
        We send account emails you need (verification codes and password resets), which can’t be switched off. Optional emails, such
        as new sign-in alerts, can be turned off in Settings or with the link at the bottom of the email. We never send marketing email.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>If we make important changes we’ll tell you in the app or by email before they take effect. The date and version at the top show when it was last changed.</p>
    </LegalLayout>
  );
}
