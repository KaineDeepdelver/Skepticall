import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { BlockProvider, useBlocks } from './BlockContext';

global.IS_REACT_ACT_ENVIRONMENT = true;

const mockApi = { list: jest.fn(), block: jest.fn(), unblock: jest.fn() };
let mockUser = { id: 1 };
jest.mock('../services/api', () => ({ blockApi: { list: (...a) => mockApi.list(...a), block: (...a) => mockApi.block(...a), unblock: (...a) => mockApi.unblock(...a) } }));
jest.mock('./AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));

let api; let container; let root;
function Probe() { api = useBlocks(); return null; }
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
async function mount() {
  container = document.createElement('div'); document.body.appendChild(container);
  root = ReactDOM.createRoot(container);
  await act(async () => { root.render(<BlockProvider><Probe /></BlockProvider>); });
  await flush();
}
beforeEach(() => { Object.values(mockApi).forEach((f) => f.mockReset()); mockUser = { id: 1 }; });
afterEach(() => { act(() => root.unmount()); container.remove(); });

test('loads who is blocked and answers by id, whether the id is a number or a string', async () => {
  mockApi.list.mockResolvedValue([{ userId: 7, username: 'rin' }]);
  await mount();
  expect(api.isBlocked(7)).toBe(true);
  expect(api.isBlocked('7')).toBe(true);
  expect(api.isBlocked(8)).toBe(false);
  expect(api.blockedIds.has(7)).toBe(true);
});

test('blocking and unblocking call the server, then refresh the list', async () => {
  mockApi.list.mockResolvedValueOnce([]).mockResolvedValueOnce([{ userId: 7, username: 'rin' }]).mockResolvedValueOnce([]);
  mockApi.block.mockResolvedValue(); mockApi.unblock.mockResolvedValue();
  await mount();
  expect(api.isBlocked(7)).toBe(false);

  await act(async () => { await api.block(7); });
  expect(mockApi.block).toHaveBeenCalledWith(7);
  expect(api.isBlocked(7)).toBe(true);

  await act(async () => { await api.unblock(7); });
  expect(mockApi.unblock).toHaveBeenCalledWith(7);
  expect(api.isBlocked(7)).toBe(false);
});

test('a failed block is reported to the caller and changes nothing', async () => {
  mockApi.list.mockResolvedValue([]);
  mockApi.block.mockRejectedValue(new Error('nope'));
  await mount();
  await expect(act(async () => { await api.block(7); })).rejects.toThrow('nope');
  expect(api.isBlocked(7)).toBe(false);
});

test('signed out: nothing is blocked and the server is not asked', async () => {
  mockUser = null;
  await mount();
  expect(mockApi.list).not.toHaveBeenCalled();
  expect(api.blocked).toEqual([]);
});
