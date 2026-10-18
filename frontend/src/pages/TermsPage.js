import React from 'react';
import { Link } from 'react-router-dom';
import LegalLayout from '../legal/LegalLayout';
import { MIN_AGE, business, operatorName } from '../config/business';

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p>
        These terms are the agreement between you and {operatorName} (“we”) for using Skepticall. Please read them together with
        our <Link to="/privacy-policy">Privacy Policy</Link> and <Link to="/cookie-policy">Cookie Policy</Link>.
      </p>

      <h2>1. Who can use Skepticall</h2>
      <p>You must be at least {MIN_AGE} years old and able to enter a binding agreement. By creating an account you confirm this and accept these terms.</p>

      <h2>2. Your account</h2>
      <ul>
        <li>Give accurate information and keep your password and encryption key safe. You are responsible for what happens under your account.</li>
        <li>Tell us right away if you think someone else has access to it.</li>
        <li>One person per account. Don’t sell or transfer accounts.</li>
      </ul>

      <h2>3. Encryption, and what it means for you</h2>
      <p>
        Messages and files are end-to-end encrypted, so we can’t read them or help you recover them. Your encryption key is stored on your
        device. <strong>If you lose your key and have no backup, your old messages cannot be recovered.</strong> You can download a key
        backup in Settings → Security.
      </p>

      <h2>4. How to behave</h2>
      <p>You agree not to use Skepticall to:</p>
      <ul>
        <li>break the law, or infringe other people’s rights;</li>
        <li>harass, threaten or abuse anyone, or share content that sexualises minors, promotes violence or hate;</li>
        <li>send spam, run scams or impersonate someone;</li>
        <li>spread malware, or try to break, probe or overload the service or other people’s accounts;</li>
        <li>use bots or scrape the service without our permission.</li>
      </ul>
      <p>Because messages are encrypted we can’t review them, but we can act on reports and on account-level signals, including removing accounts.</p>

      <h2>5. Your content</h2>
      <p>
        You keep ownership of what you share. You give us only the limited permission needed to run the service: to store, relay and
        show your content to the people you send it to. You’re responsible for having the right to share it.
      </p>

      <h2>6. Fees</h2>
      <p>Skepticall is currently free. If that changes we’ll tell you first, and nothing is charged without your explicit action. See the <Link to="/refund-policy">Refund Policy</Link>.</p>

      <h2>7. The service</h2>
      <p>We work to keep Skepticall available and secure, but we can’t promise it will always be uninterrupted or error-free. We may change features, and we’ll give notice of big changes where we can.</p>

      <h2>8. Ending your account</h2>
      <p>
        You can delete your account whenever you like (Settings → Delete account, or <Link to="/data-deletion">here</Link>). We may suspend or
        remove accounts that break these terms or put others at risk.
      </p>

      <h2>9. Responsibility</h2>
      <p>
        The service is provided “as is”. To the extent the law allows, we aren’t liable for indirect or consequential losses, or for loss
        of messages or data (including through a lost encryption key). Nothing in these terms limits liability that the law doesn’t allow us to limit,
        such as for death or personal injury caused by negligence, or for fraud, and your legal rights as a consumer are not affected.
      </p>

      <h2>10. Changes to these terms</h2>
      <p>If we change these terms in a way that matters, we’ll tell you before it takes effect, and you can close your account if you don’t agree.</p>

      <h2>11. Governing law</h2>
      <p>
        These terms are governed by the laws of {business.country || 'the country where the operator is established'}, without removing any
        mandatory consumer protections of the country where you live.
      </p>

      <h2>12. Contact</h2>
      <p>{business.email ? <>Questions? Write to <a href={`mailto:${business.email}`}>{business.email}</a>.</> : <>Our contact details are listed below.</>}</p>
    </LegalLayout>
  );
}
