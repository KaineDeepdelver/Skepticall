import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
import LandingPage from './LandingPage';
import { ConsentProvider } from '../consent/ConsentContext';
import HomeEntry from './HomeEntry';
import { useAuth } from '../context/AuthContext';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('landing page content', () => {
  const html = renderToStaticMarkup(
    <ConsentProvider>
      <StaticRouter location="/">
        <LandingPage />
      </StaticRouter>
    </ConsentProvider>
  );

  test('has the headline and a single h1', () => {
    expect(html).toContain('Talk freely.');
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  test('sends visitors to sign up and log in', () => {
    expect(html).toContain('href="/accounts/register"');
    expect(html).toContain('href="/accounts/login"');
    expect(html.match(/href="\/accounts\/register"/g).length).toBeGreaterThanOrEqual(2);
  });

  test('links to the legal pages and the account recovery page', () => {
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy-policy"');
    expect(html).toContain('href="/forgot-password"');
    expect(html).toContain('href="/cookie-policy"');
    expect(html).toContain('href="/refund-policy"');
    expect(html).toContain('href="/data-deletion"');
    expect(html).toContain('Cookie settings');
  });

  test('makes no promises the app does not keep', () => {
    expect(html).not.toMatch(/history (is|stays) .{0,20}(on your|saved on your)/i);
    expect(html).not.toMatch(/no message archive/i);
    expect(html).not.toMatch(/\b(best|#1|number one|trusted by|millions|as seen on)\b/i);
  });

  test('every in-page link has a matching section', () => {
    for (const id of ['privacy', 'calls', 'share']) {
      expect(html).toContain(`href="#${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('id="main"');
  });

  test('has a skip link, and the illustrations are hidden from screen readers', () => {
    expect(html).toContain('href="#main"');
    expect(html).toMatch(/class="lp-mock"[^>]*aria-hidden="true"/);
  });

  test('uses no external images or scripts', () => {
    expect(html).not.toMatch(/<img/);
    expect(html).not.toMatch(/<script/);
    // no resource or link may point off-site (the SVG xmlns namespace URL is not a request)
    expect(html).not.toMatch(/(?:src|href)="https?:\/\//);
  });
});

describe('"/" entry point', () => {
  let container;
  let root;

  function Shell() {
    return (
      <div data-testid="app-shell">
        <Outlet />
      </div>
    );
  }

  // Same route layout as App.js: HomeEntry above the AppLayout route.
  function renderAt(path) {
    act(() => {
      root.render(
        <ConsentProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/" element={<HomeEntry />} />
              <Route path="/" element={<Shell />}>
                <Route path="messages" element={<p>messages page</p>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </ConsentProvider>
      );
    });
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test('a visitor sees the introduction page, without the app shell', () => {
    useAuth.mockReturnValue({ user: null });

    renderAt('/');

    expect(container.textContent).toContain('Talk freely.');
    expect(container.querySelector('[data-testid="app-shell"]')).toBeNull();
  });

  test('a logged-in user goes straight to their messages', () => {
    useAuth.mockReturnValue({ user: { id: 1 } });

    renderAt('/');

    expect(container.textContent).toContain('messages page');
    expect(container.textContent).not.toContain('Talk freely.');
    expect(container.querySelector('[data-testid="app-shell"]')).not.toBeNull();
  });
});
