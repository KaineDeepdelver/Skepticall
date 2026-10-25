import { webcrypto } from 'crypto';
import { TextEncoder as NodeTE, TextDecoder as NodeTD } from 'util';
import { createMessageCache, MAX_PER_CHAT } from './messageCache';

if (typeof global.TextEncoder === 'undefined') { global.TextEncoder = NodeTE; global.TextDecoder = NodeTD; }

function mapBackend() {
  const m = new Map();
  return { m, get: async (k) => m.get(k), set: async (k, v) => { m.set(k, v); }, del: async (k) => { m.delete(k); }, clear: async () => { m.clear(); } };
}
// Writes are held back (long delay) and pushed out with flush(), so nothing here depends on timing.
const make = (backend = mapBackend(), extra = {}) => ({ backend, cache: createMessageCache({ backend, webcrypto, writeDelayMs: 60000, ...extra }) });
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const msgs = (n, text = 'hello') => Array.from({ length: n }, (_, i) => ({ id: i + 1, content: `${text} ${i + 1}` }));

test('round trip: a second cache instance (a page refresh) reads what the first one saved', async () => {
  const { backend, cache } = make();
  cache.set(1, 'd2', msgs(3));
  await cache.flush();
  const reopened = createMessageCache({ backend, webcrypto });          // fresh memory, same disk
  expect(await reopened.get(1, 'd2')).toEqual(msgs(3));
});

test('peek is instant and memory-only; get falls back to disk', async () => {
  const { backend, cache } = make();
  cache.set(1, 'd2', msgs(2));
  expect(cache.peek(1, 'd2')).toEqual(msgs(2));
  await cache.flush();
  const reopened = createMessageCache({ backend, webcrypto });
  expect(reopened.peek(1, 'd2')).toBeNull();
  expect(await reopened.get(1, 'd2')).toEqual(msgs(2));
  expect(reopened.peek(1, 'd2')).toEqual(msgs(2));                      // now warm
});

test('what is stored on disk is encrypted: the message text does not appear in it', async () => {
  const { backend, cache } = make();
  cache.set(1, 'd2', [{ id: 1, content: 'SECRET-PLAINTEXT-MARKER' }]);
  await cache.flush();
  const rec = backend.m.get('entry:1:d2');
  const blob = Buffer.from(rec.ct).toString('latin1');
  expect(blob).not.toContain('SECRET-PLAINTEXT-MARKER');
  expect(JSON.stringify(Object.values(rec))).not.toContain('SECRET-PLAINTEXT-MARKER');
  // and the wrapping key is a non-extractable CryptoKey, not raw bytes
  const key = backend.m.get('wrapKey');
  expect(key.extractable).toBe(false);
});

test('if the key is lost or the record is damaged, it is a miss, never an error or wrong data', async () => {
  const { backend, cache } = make();
  cache.set(1, 'd2', msgs(2)); await cache.flush();
  backend.m.delete('wrapKey');                                           // e.g. key wiped, storage partly cleared
  expect(await createMessageCache({ backend, webcrypto }).get(1, 'd2')).toBeNull();

  const b2 = mapBackend(); const c2 = createMessageCache({ backend: b2, webcrypto, writeDelayMs: 60000 });
  c2.set(1, 'd2', msgs(2)); await c2.flush();
  const rec = b2.m.get('entry:1:d2'); rec.ct = new Uint8Array(rec.ct).map((b, i) => (i === 3 ? b ^ 1 : b)).buffer;
  expect(await createMessageCache({ backend: b2, webcrypto }).get(1, 'd2')).toBeNull();
});

test('accounts are kept apart', async () => {
  const { backend, cache } = make();
  cache.set(1, 'd2', msgs(2, 'mine')); cache.set(5, 'd2', msgs(2, 'theirs')); await cache.flush();
  const reopened = createMessageCache({ backend, webcrypto });
  expect((await reopened.get(1, 'd2'))[0].content).toBe('mine 1');
  expect((await reopened.get(5, 'd2'))[0].content).toBe('theirs 1');
  expect(await reopened.get(9, 'd2')).toBeNull();
});

test('disk keeps only the most recent messages of a chat; memory keeps all', async () => {
  const { backend, cache } = make();
  cache.set(1, 'd2', msgs(MAX_PER_CHAT + 50)); await cache.flush();
  expect(cache.peek(1, 'd2')).toHaveLength(MAX_PER_CHAT + 50);
  const onDisk = await createMessageCache({ backend, webcrypto }).get(1, 'd2');
  expect(onDisk).toHaveLength(MAX_PER_CHAT);
  expect(onDisk[onDisk.length - 1].id).toBe(MAX_PER_CHAT + 50);          // newest kept
});

test('clearAll (logout) wipes memory, disk and the key, and drops writes still waiting', async () => {
  const { backend, cache } = make(mapBackend(), { writeDelayMs: 60 });
  cache.set(1, 'd2', msgs(2));                                           // write is still queued
  await cache.clearAll();
  await wait(120);
  expect(backend.m.size).toBe(0);                                        // the queued write never landed
  expect(cache.peek(1, 'd2')).toBeNull();

  const b2 = mapBackend(); const c2 = createMessageCache({ backend: b2, webcrypto, writeDelayMs: 60000 });
  c2.set(1, 'd2', msgs(2)); await c2.flush();
  expect(b2.m.size).toBeGreaterThan(0);
  await c2.clearAll();
  expect(b2.m.size).toBe(0);
  expect(await c2.get(1, 'd2')).toBeNull();
});

test('remove deletes one chat only', async () => {
  const { backend, cache } = make();
  cache.set(1, 'd2', msgs(1)); cache.set(1, 'd3', msgs(1)); await cache.flush();
  await cache.remove(1, 'd2');
  const reopened = createMessageCache({ backend, webcrypto });
  expect(await reopened.get(1, 'd2')).toBeNull();
  expect(await reopened.get(1, 'd3')).not.toBeNull();
});

test('flush writes pending changes immediately (used when the tab is closing)', async () => {
  const { backend, cache } = make(mapBackend(), { writeDelayMs: 60000 });
  cache.set(1, 'd2', msgs(2));
  expect(backend.m.size).toBe(0);
  await cache.flush();
  expect(await createMessageCache({ backend, webcrypto }).get(1, 'd2')).toEqual(msgs(2));
});

test('without storage support it still works from memory and never throws', async () => {
  const cache = createMessageCache({ backend: null, webcrypto: null });
  expect(cache.diskAvailable).toBe(false);
  cache.set(1, 'd2', msgs(2));
  expect(cache.peek(1, 'd2')).toEqual(msgs(2));
  expect(await cache.get(1, 'd2')).toEqual(msgs(2));
  await expect(cache.clearAll()).resolves.toBeUndefined();
});
