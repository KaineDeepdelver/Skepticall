/**
 * Message cache: lets the chat list and chats open instantly, then refresh from the server.
 *
 * Two layers:
 *   1. memory   survives moving between pages in the app (Messages -> Settings -> Messages)
 *   2. disk     survives a refresh or a new tab (IndexedDB), encrypted at rest
 *
 * The disk copy holds readable messages, so it is encrypted with AES-GCM under a NON-EXTRACTABLE
 * key the browser stores next to it (the same approach as the private-key store): copying the
 * storage, a profile backup or a disk image does not reveal the messages. It does not stop script
 * running on our own page, which is what the strict Content-Security-Policy is for. If the
 * browser cannot do this (no WebCrypto/IndexedDB, e.g. an insecure context) nothing is written
 * to disk and only the memory layer is used.
 *
 * Entries are per account. Logging out wipes everything (clearAll), key included. Each chat keeps
 * only its most recent messages on disk, so the cache stays small and quick to read.
 */

export const MAX_PER_CHAT = 200;
const DB_NAME = 'skepticall-cache';
const STORE = 'kv';
const KEY_ID = 'wrapKey';
const entryId = (userId, name) => `entry:${userId}:${name}`;

/** IndexedDB-backed key/value store. Any object with get/set/del/clear works (tests use a Map). */
export function idbBackend(idb = typeof indexedDB !== 'undefined' ? indexedDB : null) {
  if (!idb) return null;
  let dbPromise = null;
  const open = () => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = idb.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  };
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const out = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(out && out.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };
  return {
    get: (id) => run('readonly', (s) => s.get(id)),
    set: (id, value) => run('readwrite', (s) => s.put(value, id)),
    del: (id) => run('readwrite', (s) => s.delete(id)),
    clear: () => run('readwrite', (s) => s.clear()),
  };
}

export function createMessageCache({
  backend = idbBackend(),
  webcrypto = typeof crypto !== 'undefined' ? crypto : null,
  maxPerChat = MAX_PER_CHAT,
  writeDelayMs = 800,
} = {}) {
  const memory = new Map();    // id -> value
  const pending = new Map();   // id -> timer, for batching disk writes
  const diskOk = !!(backend && webcrypto && webcrypto.subtle && webcrypto.getRandomValues);
  let keyPromise = null;
  let generation = 0;          // bumped by clearAll so late writes from before a logout are dropped

  async function wrapKey() {
    if (!keyPromise) {
      keyPromise = (async () => {
        const existing = await backend.get(KEY_ID);
        if (existing) return existing;
        const key = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        await backend.set(KEY_ID, key);
        return key;
      })().catch((e) => { keyPromise = null; throw e; });
    }
    return keyPromise;
  }

  async function seal(value) {
    const key = await wrapKey();
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(value));
    const ct = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    return { v: 1, iv, ct };
  }

  async function unseal(rec) {
    if (!rec || rec.v !== 1) return null;
    const key = await wrapKey();
    const pt = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv }, key, rec.ct);
    return JSON.parse(new TextDecoder().decode(pt));
  }

  const trim = (value) => (Array.isArray(value) && value.length > maxPerChat ? value.slice(-maxPerChat) : value);

  return {
    diskAvailable: diskOk,

    /** Memory only, synchronous: what the UI can show this very instant. */
    peek(userId, name) {
      return memory.get(entryId(userId, name)) || null;
    },

    /** Memory first, then disk. Resolves to null when nothing usable is cached. */
    async get(userId, name) {
      const id = entryId(userId, name);
      if (memory.has(id)) return memory.get(id);
      if (!diskOk) return null;
      const gen = generation;
      try {
        const value = await unseal(await backend.get(id));
        if (value && gen === generation) memory.set(id, value);
        return gen === generation ? value : null;
      } catch {
        return null; // unreadable (wiped key, damaged record): behave as a miss
      }
    },

    /** Updates memory now and writes to disk shortly after (bursts of changes become one write). */
    set(userId, name, value) {
      const id = entryId(userId, name);
      memory.set(id, value);
      if (!diskOk) return;
      clearTimeout(pending.get(id));
      const gen = generation;
      pending.set(id, setTimeout(async () => {
        pending.delete(id);
        try {
          const rec = await seal(trim(value));
          if (gen === generation) await backend.set(id, rec);
        } catch { /* a failed cache write must never affect the app */ }
      }, writeDelayMs));
    },

    /** Writes anything still waiting, immediately. */
    async flush() {
      const ids = [...pending.keys()];
      ids.forEach((id) => { clearTimeout(pending.get(id)); pending.delete(id); });
      if (!diskOk) return;
      await Promise.all(ids.map(async (id) => {
        try { await backend.set(id, await seal(trim(memory.get(id)))); } catch { /* ignore */ }
      }));
    },

    async remove(userId, name) {
      const id = entryId(userId, name);
      clearTimeout(pending.get(id)); pending.delete(id);
      memory.delete(id);
      if (diskOk) { try { await backend.del(id); } catch { /* ignore */ } }
    },

    /** Log out / account change: forget everything, on disk and in memory, including the key. */
    async clearAll() {
      generation += 1;
      pending.forEach((t) => clearTimeout(t)); pending.clear();
      memory.clear();
      keyPromise = null;
      if (diskOk) { try { await backend.clear(); } catch { /* ignore */ } }
    },
  };
}

/** The app-wide instance. */
export const messageCache = createMessageCache();
