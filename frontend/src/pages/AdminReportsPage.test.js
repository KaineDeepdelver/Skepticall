import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminReportsPage from './AdminReportsPage';

global.IS_REACT_ACT_ENVIRONMENT = true;

const mockAdmin = { listReports: jest.fn(), resolveReport: jest.fn(), deleteUser: jest.fn() };
let mockUser = { id: 1, admin: true };
jest.mock('../services/api', () => ({ adminApi: {
  listReports: (...a) => mockAdmin.listReports(...a), resolveReport: (...a) => mockAdmin.resolveReport(...a), deleteUser: (...a) => mockAdmin.deleteUser(...a) } }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));

let container; let root;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const button = (label) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
async function mount() {
  container = document.createElement('div'); document.body.appendChild(container);
  root = ReactDOM.createRoot(container);
  await act(async () => { root.render(<MemoryRouter initialEntries={['/admin/reports']}><Routes><Route path="/admin/reports" element={<AdminReportsPage />} /><Route path="/" element={<div>home</div>} /></Routes></MemoryRouter>); });
  await flush();
}
const report = (o) => ({ id: 1, status: 'OPEN', targetType: 'USER', targetId: 9, targetUserId: 9, targetUsername: 'rin', reporterId: 2, reporterUsername: 'maya', reason: 'SPAM', createdAt: '2026-10-20T10:00:00', ...o });

beforeEach(() => { Object.values(mockAdmin).forEach((f) => f.mockReset()); mockUser = { id: 1, admin: true }; });
afterEach(() => { act(() => root.unmount()); container.remove(); });

test('someone who is not an admin is sent home and nothing is loaded', async () => {
  mockUser = { id: 2, admin: false };
  await mount();
  expect(container.textContent).toBe('home');
  expect(mockAdmin.listReports).not.toHaveBeenCalled();
});

test('child-safety reports come first, and message text is labelled as unverified', async () => {
  mockAdmin.listReports.mockResolvedValue([
    report({ id: 1, reason: 'SPAM' }),
    report({ id: 2, reason: 'CHILD_SAFETY', targetType: 'MESSAGE', evidence: 'the text' }),
  ]);
  await mount();
  const cards = [...container.querySelectorAll('.ar-card')];
  expect(cards).toHaveLength(2);
  expect(cards[0].textContent).toContain('Child safety');
  expect(cards[0].className).toContain('ar-card--urgent');
  expect(cards[0].textContent).toContain('the text');
  expect(cards[0].textContent).toContain('can’t verify');
});

test('dismissing and resolving send the note and reload the queue', async () => {
  mockAdmin.listReports.mockResolvedValue([report({ id: 5 })]);
  mockAdmin.resolveReport.mockResolvedValue({});
  await mount();
  await click(button('Dismiss')); await flush();
  expect(mockAdmin.resolveReport).toHaveBeenCalledWith(5, 'DISMISSED', undefined);
  expect(mockAdmin.listReports).toHaveBeenCalledTimes(2);
});

test('deleting an account asks first, then deletes and closes the report', async () => {
  mockAdmin.listReports.mockResolvedValue([report({ id: 5 })]);
  mockAdmin.deleteUser.mockResolvedValue({}); mockAdmin.resolveReport.mockResolvedValue({});
  const confirm = jest.spyOn(window, 'confirm');

  await mount();
  confirm.mockReturnValueOnce(false);
  await click(button('Delete account')); await flush();
  expect(mockAdmin.deleteUser).not.toHaveBeenCalled();

  confirm.mockReturnValueOnce(true);
  await click(button('Delete account')); await flush();
  expect(mockAdmin.deleteUser).toHaveBeenCalledWith(9);
  expect(mockAdmin.resolveReport).toHaveBeenCalledWith(5, 'RESOLVED', 'Account deleted');
  confirm.mockRestore();
});

test('a failed load shows the error instead of an empty "nothing here"', async () => {
  mockAdmin.listReports.mockRejectedValue(new Error(JSON.stringify({ message: 'Forbidden' })));
  await mount();
  expect(container.querySelector('[role=alert]').textContent).toBe('Forbidden');
});
