/**
 * Where this browser keeps the account's private keys (the "ring": current key first, then
 * recently rerolled ones). Stored in IndexedDB, with localStorage as a fallback.
 *
 * At rest the keys are encrypted with AES-GCM under a NON-EXTRACTABLE key that the browser
 * stores next to them. Copying the storage (a profile backup, a disk image, an exported
 * IndexedDB dump, a synced profile) therefore doesn't give anyone the private key: the wrapping
 * key's bytes can never be read out of the browser.
 *
 * Honest limits: this does not stop script running on our own page (an XSS bug) from asking the
 * browser to decrypt, which is why the app also ships a strict Content-Security-Policy and has no
 * raw-HTML sinks. Clearing site data deletes the keys; they then have to come back from a backup.
 * If the browser can't store CryptoKeys (localStorage fallback, or an insecure context) the keys
 * are stored unwrapped.
 */
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';

const DB_NAME = 'skepticall-e2e';
const STORE = 'kv';
const WRAP_KEY_ID = 'wrapKey';

function serialize(ring) {
  return ring.map((p) => ({ publicKey: encodeBase64(p.publicKey), secretKey: encodeBase64(p.secretKey) }));
}

function deserialize(raw) {
  if (!Array.isArray(raw)) return null;
  try {
    const ring = raw.map((p) => {
      const secretKey = decodeBase64(p.secretKey);
      // the public half is re-derived, so a corrupted record can never mismatch itself
      return { secretKey, publicKey: nacl.box.keyPair.fromSecretKey(secretKey).publicKey };
    });
    return ring.length ? ring : null;
  } catch {
    return null;
  }
}

// == storage backends ==========================================================
// `canHoldCryptoKeys`: whether the wrapping key (a CryptoKey object) can be stored there.

export function createMemoryBackend() {
  const m = new Map();
  return {
    canHoldCryptoKeys: true,
    get: async (k) => m.get(k),
    set: async (k, v) => { m.set(k, v); },
    remove: async (k) => { m.delete(k); },
  };
}

export function createLocalStorageBackend(ls = window.localStorage) {
  const key = (k) => `${DB_NAME}:${k}`;
  return {
    canHoldCryptoKeys: false,
    get: async (k) => { const v = ls.getItem(key(k)); return v ? JSON.parse(v) : undefined; },
    set: async (k, v) => { ls.setItem(key(k), JSON.stringify(v)); },
    remove: async (k) => { ls.removeItem(key(k)); },
  };
}

export function createIndexedDbBackend(idb = window.indexedDB) {
  let dbPromise;
  const open = () => dbPromise || (dbPromise = new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  const run = (mode, fn) => open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request && request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
  return {
    canHoldCryptoKeys: true,
    get: (k) => run('readonly', (s) => s.get(k)),
    set: (k, v) => run('readwrite', (s) => s.put(v, k)),
    remove: (k) => run('readwrite', (s) => s.delete(k)),
  };
}

function defaultBackend() {
  try {
    if (typeof indexedDB !== 'undefined') return createIndexedDbBackend();
  } catch { /* fall through */ }
  return createLocalStorageBackend();
}

// == the store =================================================================

export function createKeyStore(backend = defaultBackend(), options = {}) {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  const subtle = options.subtle !== undefined ? options.subtle : cryptoApi && cryptoApi.subtle;
  const randomBytes = options.randomBytes || ((n) => nacl.randomBytes(n));
  const wrapping = !!(subtle && backend.canHoldCryptoKeys);

  const ringKey = (userId) => `ring:${userId}`;
  const pendingKey = (username) => `pending:${String(username).toLowerCase()}`;

  async function wrapKey(create) {
    let key = await backend.get(WRAP_KEY_ID);
    if (!key && create) {
      key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await backend.set(WRAP_KEY_ID, key);
    }
    return key;
  }

  async function seal(ring) {
    const plain = serialize(ring);
    if (!wrapping) return plain;
    const key = await wrapKey(true);
    const iv = randomBytes(12);
    const data = await subtle.encrypt({ name: 'AES-GCM', iv }, key, decodeUTF8(JSON.stringify(plain)));
    return { v: 2, iv, data: new Uint8Array(data) };
  }

  /** Returns { ring, legacy }: legacy = it was stored unwrapped and should be re-saved wrapped. */
  async function unseal(record) {
    if (!record) return { ring: null, legacy: false };
    if (Array.isArray(record)) return { ring: deserialize(record), legacy: true };
    if (record.v === 2 && wrapping) {
      try {
        const key = await wrapKey(false);
        if (!key) return { ring: null, legacy: false };
        const plain = await subtle.decrypt({ name: 'AES-GCM', iv: record.iv }, key, record.data);
        return { ring: deserialize(JSON.parse(encodeUTF8(new Uint8Array(plain)))), legacy: false };
      } catch {
        return { ring: null, legacy: false }; // wrong key or damaged: treated as "no key here"
      }
    }
    return { ring: null, legacy: false };
  }

  async function readRing(id) {
    const { ring, legacy } = await unseal(await backend.get(id));
    if (ring && legacy && wrapping) {
      try { await backend.set(id, await seal(ring)); } catch { /* keep the unwrapped copy */ }
    }
    return ring;
  }

  return {
    wraps: wrapping,
    async load(userId) { return readRing(ringKey(userId)); },
    async save(userId, ring) {
      await backend.set(ringKey(userId), await seal(ring));
      try { await navigator.storage?.persist?.(); } catch { /* best effort: ask the browser not to evict it */ }
    },
    async clear(userId) { await backend.remove(ringKey(userId)); },
    /** A key made at sign-up, before the account has an id. Adopted at first login. */
    async savePending(username, ring) { await backend.set(pendingKey(username), await seal(ring)); },
    async takePending(username) {
      const ring = await readRing(pendingKey(username));
      await backend.remove(pendingKey(username));
      return ring;
    },
    async dropPending(username) { await backend.remove(pendingKey(username)); },
  };
}
