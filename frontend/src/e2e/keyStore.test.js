/** @jest-environment node */
import nacl from 'tweetnacl';
import { webcrypto } from 'crypto';
import { createKeyStore, createLocalStorageBackend, createMemoryBackend } from './keyStore';
import { b64 } from './box';

const subtle = webcrypto.subtle;
const randomBytes = (n) => webcrypto.getRandomValues(new Uint8Array(n));
const pair = () => nacl.box.keyPair();
const hex = (u8) => Buffer.from(u8).toString('hex');

function fakeLocalStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), dump: () => [...m.values()].join('\n') };
}

describe('key store', () => {
  test('keys round trip', async () => {
    const store = createKeyStore(createMemoryBackend(), { subtle, randomBytes });
    const ring = [pair(), pair()];

    await store.save(7, ring);
    const loaded = await store.load(7);

    expect(loaded.map((p) => hex(p.secretKey))).toEqual(ring.map((p) => hex(p.secretKey)));
    expect(loaded.map((p) => hex(p.publicKey))).toEqual(ring.map((p) => hex(p.publicKey)));
  });

  test('at rest the private key is encrypted and the wrapping key cannot be exported', async () => {
    const backend = createMemoryBackend();
    const store = createKeyStore(backend, { subtle, randomBytes });
    const ring = [pair()];

    await store.save(7, ring);
    const raw = await backend.get('ring:7');
    const wrapKey = await backend.get('wrapKey');

    expect(store.wraps).toBe(true);
    expect(raw.v).toBe(2);
    expect(Buffer.from(raw.data).includes(Buffer.from(ring[0].secretKey))).toBe(false);
    expect(JSON.stringify(raw)).not.toContain(b64(ring[0].secretKey));
    expect(wrapKey.extractable).toBe(false);
    await expect(subtle.exportKey('raw', wrapKey)).rejects.toThrow();
  });

  test('a copy of the stored ring is useless without the wrapping key', async () => {
    const backend = createMemoryBackend();
    await createKeyStore(backend, { subtle, randomBytes }).save(7, [pair()]);
    const copiedRing = await backend.get('ring:7');

    const elsewhere = createMemoryBackend(); // another browser: has the ring record, not the CryptoKey
    await elsewhere.set('ring:7', copiedRing);

    expect(await createKeyStore(elsewhere, { subtle, randomBytes }).load(7)).toBeNull();
  });

  test('tampered storage is treated as no key, not as a crash', async () => {
    const backend = createMemoryBackend();
    const store = createKeyStore(backend, { subtle, randomBytes });
    await store.save(7, [pair()]);
    const raw = await backend.get('ring:7');
    raw.data[0] ^= 1;

    expect(await store.load(7)).toBeNull();
  });

  test('a ring stored unwrapped by an older version is read, then re-saved wrapped', async () => {
    const backend = createMemoryBackend();
    const ring = [pair()];
    await backend.set('ring:7', [{ publicKey: b64(ring[0].publicKey), secretKey: b64(ring[0].secretKey) }]);
    const store = createKeyStore(backend, { subtle, randomBytes });

    const loaded = await store.load(7);

    expect(hex(loaded[0].secretKey)).toBe(hex(ring[0].secretKey));
    expect((await backend.get('ring:7')).v).toBe(2);
  });

  test('without CryptoKey storage (localStorage) keys are stored as before', async () => {
    const ls = fakeLocalStorage();
    const store = createKeyStore(createLocalStorageBackend(ls), { subtle, randomBytes });
    const ring = [pair()];

    await store.save(7, ring);

    expect(store.wraps).toBe(false);
    expect(hex((await store.load(7))[0].secretKey)).toBe(hex(ring[0].secretKey));
  });

  test('a key made at sign-up is kept under the username and consumed once', async () => {
    const store = createKeyStore(createMemoryBackend(), { subtle, randomBytes });
    const ring = [pair()];

    await store.savePending('NewBie', ring);

    expect(hex((await store.takePending('newbie'))[0].secretKey)).toBe(hex(ring[0].secretKey));
    expect(await store.takePending('newbie')).toBeNull();
  });

  test('clear removes the ring', async () => {
    const store = createKeyStore(createMemoryBackend(), { subtle, randomBytes });
    await store.save(7, [pair()]);

    await store.clear(7);

    expect(await store.load(7)).toBeNull();
  });
});
