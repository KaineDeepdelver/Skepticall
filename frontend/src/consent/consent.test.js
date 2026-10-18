import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ConsentProvider, useConsent } from './ConsentContext';
import CookieBanner from './CookieBanner';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let api;
function Probe() {
  api = useConsent();
  return null;
}

describe('cookie consent', () => {
  let container;
  let root;
  const mount = (ui) => act(() => root.render(<MemoryRouter><ConsentProvider>{ui}</ConsentProvider></MemoryRouter>));

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  test('nothing optional is on until the person chooses', () => {
    mount(<Probe />);

    expect(api.decided).toBe(false);
    expect(api.google).toBe(false);
    expect(api.panelOpen).toBe(true); // the banner shows
  });

  test('accepting turns Google reCAPTCHA on and remembers it', () => {
    mount(<Probe />);

    act(() => api.acceptAll());

    expect(api.google).toBe(true);
    expect(api.decided).toBe(true);
    expect(api.panelOpen).toBe(false);
    expect(JSON.parse(localStorage.getItem('skepticall_consent'))).toMatchObject({ v: 1, google: true });
  });

  test('rejecting keeps it off and remembers that too', () => {
    mount(<Probe />);

    act(() => api.rejectOptional());

    expect(api.google).toBe(false);
    expect(api.decided).toBe(true);
    expect(JSON.parse(localStorage.getItem('skepticall_consent')).google).toBe(false);
  });

  test('the choice survives a reload, and can be changed from "Cookie settings"', () => {
    localStorage.setItem('skepticall_consent', JSON.stringify({ v: 1, google: true, at: 'x' }));
    mount(<Probe />);
    expect(api.google).toBe(true);
    expect(api.panelOpen).toBe(false);

    act(() => api.reopen());
    expect(api.panelOpen).toBe(true);

    act(() => api.setGoogle(false));
    expect(api.google).toBe(false);
    expect(api.panelOpen).toBe(false);
  });

  test('a damaged or old record counts as no decision', () => {
    localStorage.setItem('skepticall_consent', '{not json');
    mount(<Probe />);
    expect(api.decided).toBe(false);
  });

  test('the banner gives Accept and Reject exactly the same weight', () => {
    mount(<CookieBanner />);

    const buttons = [...container.querySelectorAll('button')];
    const accept = buttons.find((b) => b.textContent === 'Accept all');
    const reject = buttons.find((b) => b.textContent === 'Reject non-essential');

    expect(accept).toBeTruthy();
    expect(reject).toBeTruthy();
    expect(accept.className).toBe(reject.className);
  });

  test('the banner goes away after a choice and comes back on request', () => {
    mount(<><CookieBanner /><Probe /></>);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    act(() => api.rejectOptional());
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    act(() => api.reopen());
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
