import React from 'react';
import fs from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { ConsentProvider } from '../consent/ConsentContext';
import PrivacyPolicyPage from './PrivacyPolicyPage';
import TermsPage from './TermsPage';
import CookiePolicyPage from './CookiePolicyPage';
import RefundPolicyPage from './RefundPolicyPage';
import DataDeletionPage from './DataDeletionPage';

const render = (el) => renderToStaticMarkup(<ConsentProvider><StaticRouter location="/">{el}</StaticRouter></ConsentProvider>);

/** Every localStorage/sessionStorage key the app really uses. */
function storageKeysInUse() {
  const keys = new Set();
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.js') && !p.endsWith('.test.js')) {
        const src = fs.readFileSync(p, 'utf8');
        for (const m of src.matchAll(/(?:local|session)Storage\.(?:get|set|remove)Item\(\s*(['"`])([^'"`$]+)\1/g)) keys.add(m[2]);
      }
    }
  };
  walk(path.join(__dirname, '..'));
  return [...keys];
}

describe('legal pages', () => {
  test('the Cookie Policy lists every storage key the app uses (so it can never silently fall behind)', () => {
    const html = render(<CookiePolicyPage />);
    const keys = storageKeysInUse();

    expect(keys.length).toBeGreaterThan(8);
    for (const key of keys) {
      expect(html).toContain(key);
    }
  });

  test('the Cookie Policy says what needs consent and offers a way to change it', () => {
    const html = render(<CookiePolicyPage />);

    expect(html).toMatch(/no advertising or analytics cookies/i);
    expect(html).toContain('reCAPTCHA');
    expect(html).toContain('Cookie settings');
  });

  test('the Privacy Policy covers the basics it must', () => {
    const html = render(<PrivacyPolicyPage />);

    for (const needle of ['Who is responsible', 'Legal basis', 'Your rights', 'Children', 'How long we keep data', 'Email delivery', 'Cloudflare', 'Neon', 'Render', 'Metered', 'Google', '30 days']) {
      expect(html).toContain(needle);
    }
  });

  test('the Privacy Policy no longer makes the claims the code could not back up', () => {
    const html = render(<PrivacyPolicyPage />);

    expect(html).not.toMatch(/stored locally on our infrastructure/i);
    expect(html).not.toMatch(/permanently removed/i);
  });

  test('the Terms cover age, encryption/key loss, termination and governing law', () => {
    const html = render(<TermsPage />);

    for (const needle of ['at least 16', 'cannot be recovered', 'Ending your account', 'Governing law']) {
      expect(html).toContain(needle);
    }
  });

  test('the Refund Policy says plainly that nothing is charged, and no fake prices appear', () => {
    const html = render(<RefundPolicyPage />);

    expect(html).toContain('Skepticall is free');
    expect(html).not.toMatch(/[$€£]\s?\d/);
  });

  test('the data deletion page offers three ways and explains what is deleted', () => {
    const html = render(<DataDeletionPage />);

    expect(html).toContain('In the app');
    expect(html).toContain('Delete your data by email');
    expect(html).toContain('What gets deleted');
    expect(html).toContain('type="email"');
  });

  test('every legal page links to the others', () => {
    for (const page of [<PrivacyPolicyPage />, <TermsPage />, <CookiePolicyPage />, <RefundPolicyPage />, <DataDeletionPage />]) {
      const html = render(page);
      for (const href of ['/terms', '/privacy-policy', '/cookie-policy', '/refund-policy', '/data-deletion']) {
        expect(html).toContain(`href="${href}"`);
      }
    }
  });
});
