import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import ExitButton, { BackChevron } from './ExitButton';

global.IS_REACT_ACT_ENVIRONMENT = true;
let container; let root;
async function mount(el) {
  container = document.createElement('div'); document.body.appendChild(container);
  root = ReactDOM.createRoot(container);
  await act(async () => { root.render(el); });
}
afterEach(() => { act(() => root.unmount()); container.remove(); });

test('is a button with a spoken label and a "<" icon, not a text arrow', async () => {
  const onClick = jest.fn();
  await mount(<ExitButton label="Close notifications" onClick={onClick} />);
  const btn = container.querySelector('button');
  expect(btn.getAttribute('aria-label')).toBe('Close notifications');
  expect(btn.querySelector('svg path')).not.toBeNull();
  expect(btn.textContent).toBe('');                       // no ← or ✕ characters
  act(() => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  expect(onClick).toHaveBeenCalledTimes(1);
});

test('defaults to "Back" and does not submit a form it sits in', async () => {
  await mount(<form><ExitButton onClick={() => {}} /></form>);
  const btn = container.querySelector('button');
  expect(btn.getAttribute('aria-label')).toBe('Back');
  expect(btn.getAttribute('type')).toBe('button');
});

test('the inline chevron for text links is an icon and is hidden from screen readers', async () => {
  await mount(<a href="/x"><BackChevron /> Back to sign in</a>);
  const svg = container.querySelector('svg');
  expect(svg).not.toBeNull();
  expect(svg.getAttribute('aria-hidden')).toBe('true');
  expect(container.textContent.trim()).toBe('Back to sign in');
});
