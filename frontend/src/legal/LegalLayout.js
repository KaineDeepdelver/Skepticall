import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import SkepticallLogo from '../components/SkepticallLogo';
import { useConsent } from '../consent/ConsentContext';
import { LEGAL_UPDATED, TERMS_VERSION, business, hasBusinessDetails, operatorName } from '../config/business';
import './legal.css';

export const LEGAL_LINKS = [
  { to: '/terms', label: 'Terms of Service' },
  { to: '/privacy-policy', label: 'Privacy Policy' },
  { to: '/cookie-policy', label: 'Cookie Policy' },
  { to: '/refund-policy', label: 'Refund Policy' },
  { to: '/data-deletion', label: 'Delete my data' },
];

/** Opens the cookie choices panel again (a consent can be changed as easily as it was given). */
export function CookieSettingsButton({ className = 'lg-linkbtn', children = 'Cookie settings' }) {
  const { reopen } = useConsent();
  return <button type="button" className={className} onClick={reopen}>{children}</button>;
}

/** Who runs the service: name, address, contact, registration. Only the details that are set are shown. */
export function BusinessDetails({ className = 'lg-card lg-operator' }) {
  if (!hasBusinessDetails) {
    return process.env.NODE_ENV === 'production' ? null : (
      <div className={className}>
        <strong>Operator details are not set.</strong> Add REACT_APP_BUSINESS_NAME, REACT_APP_BUSINESS_ADDRESS and
        REACT_APP_CONTACT_EMAIL to your .env (see .env.example). This notice is only shown in development.
      </div>
    );
  }
  return (
    <section className={className} aria-labelledby="operator-heading">
      <h2 id="operator-heading">Who runs Skepticall</h2>
      <p>
        <strong>{operatorName}</strong>
        {business.address && <><br />{business.address}</>}
        {business.country && <><br />{business.country}</>}
        {business.registration && <><br />Registration: {business.registration}</>}
        {business.email && <><br />Contact: <a href={`mailto:${business.email}`}>{business.email}</a></>}
      </p>
    </section>
  );
}

export default function LegalLayout({ title, children, showUpdated = true }) {
  return (
    <div className="lg">
      <a className="lg-skip" href="#legal-main">Skip to content</a>
      <header className="lg-head">
        <Link to="/" className="lg-brand" aria-label="Skepticall home"><SkepticallLogo size={20} /></Link>
        <nav className="lg-nav" aria-label="Legal pages">
          {LEGAL_LINKS.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
        </nav>
      </header>
      <main id="legal-main" className="lg-main">
        <h1>{title}</h1>
        {showUpdated && <p className="lg-meta">Last updated {LEGAL_UPDATED} · version {TERMS_VERSION}</p>}
        {children}
        <BusinessDetails />
      </main>
      <footer className="lg-foot">
        <span>© {new Date().getFullYear()} {operatorName}</span>
        <CookieSettingsButton />
      </footer>
    </div>
  );
}
