import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import useGoBack from './useGoBack';

global.IS_REACT_ACT_ENVIRONMENT = true;
let container; let root;

function Here() { return <span id="at">{useLocation().pathname}</span>; }
function Page({ fallback }) {
  const back = useGoBack(fallback);
  return <button id="back" onClick={back}>back</button>;
}
async function mount(entries, index, fallback) {
  container = document.createElement('div'); document.body.appendChild(container);
  root = ReactDOM.createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={entries} initialIndex={index}>
        <Here />
        <Routes>
          <Route path="/profile/:u" element={<Page fallback={fallback} />} />
          <Route path="*" element={<div />} />
        </Routes>
      </MemoryRouter>,
    );
  });
}
const at = () => container.querySelector('#at').textContent;
const back = () => act(async () => { container.querySelector('#back').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

test('after following a link inside the app, Back goes to the page you came from', async () => {
  await mount(['/messages', '/profile/maya'], 1, '/');
  expect(at()).toBe('/profile/maya');
  await back();
  expect(at()).toBe('/messages');
});

test('a profile opened directly has nothing to go back to, so Back goes to the fallback', async () => {
  await mount(['/profile/maya'], 0, '/');
  await back();
  expect(at()).toBe('/');
});

test('the fallback can be chosen', async () => {
  await mount(['/profile/maya'], 0, '/messages');
  await back();
  expect(at()).toBe('/messages');
});
