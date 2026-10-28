import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import RecoveryDialog from './RecoveryDialog';

global.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no Web Crypto; every real browser does.
Object.defineProperty(globalThis, 'crypto', { value: require('crypto').webcrypto, configurable: true }); // eslint-disable-line global-require

const mockService = { saveVault: jest.fn() };
jest.mock('./E2EEContext', () => ({ useE2EE: () => ({ service: mockService }) }));

let container; let root;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const q = (sel) => container.querySelector(sel);
const text = () => container.textContent;
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const button = (label) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
function type(el, value) {
  return act(async () => {
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
    set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const submit = (form) => act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });

async function mount(props = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = ReactDOM.createRoot(container);
  await act(async () => { root.render(<RecoveryDialog onClose={props.onClose || (() => {})} onDone={props.onDone} />); });
  await flush();
}

beforeEach(() => { mockService.saveVault.mockReset(); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

const phraseOnScreen = () => [...container.querySelectorAll('.rec-words li')].map((li) => li.textContent.replace(/^\d+/, ''));

test('shows six words, and will not continue until you say you saved them', async () => {
  await mount();
  expect(phraseOnScreen()).toHaveLength(6);
  expect(button('Continue').disabled).toBe(true);
  await click(q('.rec-check input'));
  expect(button('Continue').disabled).toBe(false);
});

test('the full path: show, check two words, confirm password, save', async () => {
  const onDone = jest.fn();
  mockService.saveVault.mockResolvedValue(undefined);
  await mount({ onDone });
  const words = phraseOnScreen();

  await click(q('.rec-check input'));
  await click(button('Continue'));
  expect(text()).toContain('Check your copy');

  // it asks for two words by position; answer from what was shown
  const labels = [...container.querySelectorAll('label')].filter((l) => /Your word \d/.test(l.textContent));
  expect(labels).toHaveLength(2);
  for (const label of labels) {
    const n = Number(label.textContent.match(/word (\d)/)[1]);
    await type(label.querySelector('input'), words[n - 1].toUpperCase()); // case does not matter
  }
  await submit(q('form'));
  expect(text()).toContain('Confirm it’s you');

  await type(q('input[type=password]'), 'pw');
  await submit(q('form'));
  await flush();

  expect(mockService.saveVault).toHaveBeenCalledTimes(1);
  expect(mockService.saveVault.mock.calls[0][0]).toEqual({ phrase: words.join(' '), password: 'pw' });
  expect(onDone).toHaveBeenCalled();
  expect(text()).toContain('Your recovery phrase is set up');
});

test('a wrong word is caught before anything is saved', async () => {
  await mount();
  await click(q('.rec-check input'));
  await click(button('Continue'));
  const inputs = container.querySelectorAll('form input');
  await type(inputs[0], 'wrong'); await type(inputs[1], 'words');
  await submit(q('form'));
  expect(q('[role=alert]').textContent).toMatch(/don.t match/);
  expect(text()).toContain('Check your copy');
  expect(mockService.saveVault).not.toHaveBeenCalled();
});

test('a wrong password shows the server message and stays on that step', async () => {
  mockService.saveVault.mockRejectedValue(new Error('Password is incorrect'));
  await mount();
  const words = phraseOnScreen();
  await click(q('.rec-check input')); await click(button('Continue'));
  for (const label of [...container.querySelectorAll('label')].filter((l) => /Your word \d/.test(l.textContent))) {
    await type(label.querySelector('input'), words[Number(label.textContent.match(/word (\d)/)[1]) - 1]);
  }
  await submit(q('form'));
  await type(q('input[type=password]'), 'bad');
  await submit(q('form')); await flush();
  expect(q('[role=alert]').textContent).toContain('Password is incorrect');
  expect(text()).toContain('Confirm it’s you');
});

test('"Not now" and Escape close it before anything is saved', async () => {
  const onClose = jest.fn();
  await mount({ onClose });
  await click(button('Not now'));
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(mockService.saveVault).not.toHaveBeenCalled();
});
