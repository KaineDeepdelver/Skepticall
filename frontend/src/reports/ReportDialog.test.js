import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import ReportDialog from './ReportDialog';

global.IS_REACT_ACT_ENVIRONMENT = true;

const mockSubmit = jest.fn();
const mockBlock = jest.fn();
let mockBlocked = false;
jest.mock('../services/api', () => ({ reportApi: { submit: (...a) => mockSubmit(...a) } }));
jest.mock('../context/BlockContext', () => ({ useBlocks: () => ({ isBlocked: () => mockBlocked, block: (...a) => mockBlock(...a) }) }));

let container; let root;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const q = (s) => container.querySelector(s);
const text = () => container.textContent;
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const button = (label) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(label));
const submit = () => act(async () => { q('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
const type = (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const pick = (value) => click(q(`input[value="${value}"]`));

async function mount(target, onClose = () => {}) {
  container = document.createElement('div'); document.body.appendChild(container);
  root = ReactDOM.createRoot(container);
  await act(async () => { root.render(<ReportDialog target={target} onClose={onClose} />); });
}
beforeEach(() => { mockSubmit.mockReset(); mockBlock.mockReset(); mockBlocked = false; });
afterEach(() => { act(() => root.unmount()); container.remove(); });

const MESSAGE = { type: 'MESSAGE', id: 42, userId: 9, label: 'Maya', evidence: 'you are awful' };

test('you must choose what is wrong before anything is sent', async () => {
  await mount(MESSAGE);
  await submit();
  expect(q('[role=alert]').textContent).toMatch(/Choose what is wrong/);
  expect(mockSubmit).not.toHaveBeenCalled();
});

test('a message report sends the target, the reason, the detail and the text you agreed to share', async () => {
  mockSubmit.mockResolvedValue({ id: 1, status: 'OPEN' });
  await mount(MESSAGE);
  await pick('HARASSMENT');
  await type(q('textarea'), '  keeps doing this  ');
  await submit(); await flush();
  expect(mockSubmit).toHaveBeenCalledWith({ targetType: 'MESSAGE', targetId: 42, reason: 'HARASSMENT', details: 'keeps doing this', evidence: 'you are awful' });
  expect(text()).toContain('Thanks, we got it');
});

test('unticking "send the text" leaves the message out', async () => {
  mockSubmit.mockResolvedValue({ id: 1 });
  await mount(MESSAGE);
  expect(text()).toContain('we can’t read them');                      // says why it is optional
  await click(q('.rp-check input'));
  await pick('SPAM'); await submit(); await flush();
  expect(mockSubmit.mock.calls[0][0].evidence).toBeUndefined();
});

test('reporting a person has no message-text option', async () => {
  mockSubmit.mockResolvedValue({ id: 1 });
  await mount({ type: 'USER', id: 9, userId: 9, label: 'Maya' });
  expect(q('.rp-evidence')).toBeNull();
  await pick('IMPERSONATION'); await submit(); await flush();
  expect(mockSubmit).toHaveBeenCalledWith({ targetType: 'USER', targetId: 9, reason: 'IMPERSONATION', details: undefined, evidence: undefined });
});

test('afterwards it offers to block the person, and does so when asked', async () => {
  mockSubmit.mockResolvedValue({ id: 1 }); mockBlock.mockResolvedValue();
  await mount(MESSAGE);
  await pick('HATE'); await submit(); await flush();
  await click(button('Block Maya')); await flush();
  expect(mockBlock).toHaveBeenCalledWith(9);
  expect(text()).toMatch(/You blocked Maya/);
  expect(button('Block Maya')).toBeUndefined();                          // offered once
});

test('no block offer for someone already blocked, or for a whole group', async () => {
  mockSubmit.mockResolvedValue({ id: 1 });
  mockBlocked = true;
  await mount(MESSAGE);
  await pick('SPAM'); await submit(); await flush();
  expect(button('Block')).toBeUndefined();
  act(() => root.unmount()); container.remove();

  mockBlocked = false;
  await mount({ type: 'GROUP', id: 5, label: 'Crew' });
  await pick('SPAM'); await submit(); await flush();
  expect(button('Block')).toBeUndefined();
});

test('a server error is shown and the form stays open to try again', async () => {
  mockSubmit.mockRejectedValue(new Error(JSON.stringify({ message: 'You have sent a lot of reports today.' })));
  await mount(MESSAGE);
  await pick('SPAM'); await submit(); await flush();
  expect(q('[role=alert]').textContent).toContain('a lot of reports');
  expect(text()).toContain('Report this message');
});

test('Cancel and Escape close it without sending', async () => {
  const onClose = jest.fn();
  await mount(MESSAGE, onClose);
  await click(button('Cancel'));
  await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(mockSubmit).not.toHaveBeenCalled();
});
