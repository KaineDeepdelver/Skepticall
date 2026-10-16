/**
 * The web client's end-to-end encryption service. Framework-free (React lives in E2EEContext.js),
 * with its dependencies injected so it can be tested without a browser or a server.
 *
 * Status:
 *   loading        working out whether this browser has the account's key
 *   ready          key present and matches the server: messages are encrypted and decrypted
 *   needs-setup    the account has no key yet (created before encryption existed)
 *   needs-restore  the account has a key, but this browser doesn't hold it
 *
 * Always encrypted: while the status isn't `ready`, or when the recipient (or any group member)
 * has no key, nothing is sent. prepareText / prepareUpload throw EncryptionRequiredError instead of
 * falling back to plain text.
 */
import nacl from 'tweetnacl';
import { createBackup, restoreBackup } from '../backup/backupFile';
import { generateKeyPair, pruneRing } from '../crypto/keyring';
import {
  MAX_ENCRYPTED_FILE_BYTES,
  b64,
  decryptDmFile,
  decryptDmText,
  decryptGroupFile,
  decryptGroupText,
  encryptDmFile,
  encryptDmText,
  encryptGroupFile,
  encryptGroupMessage,
  guessMime,
  unb64,
} from './box';

export const UNDECRYPTABLE_TEXT = '🔒 Unable to decrypt this message';

/** Thrown when a message can't be sent because it can't be encrypted. The text is safe to show the user. */
export class EncryptionRequiredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EncryptionRequiredError';
    this.code = 'ENCRYPTION_REQUIRED';
  }
}

const NO_KEY_HERE = 'Encryption isn’t set up on this browser yet, so the message wasn’t sent.';
const NO_KEY_PEER = 'That person hasn’t turned on encryption yet, so the message wasn’t sent.';
const NO_KEY_MEMBER = 'Someone in this group hasn’t turned on encryption yet, so the message wasn’t sent.';

const KEY_TTL_MS = 5 * 60 * 1000;
const EMPTY_TTL_MS = 30 * 1000;
const SETTLE_TIMEOUT_MS = 15 * 1000;

async function defaultFetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export function createE2EE({
  store,
  api,
  fetchBytes = defaultFetchBytes,
  resolveFileUrl = (u) => u,
  makeObjectUrl = (bytes, type) => URL.createObjectURL(new Blob([bytes], { type })),
  backupKdf, // Argon2 cost override for key backups (tests use a tiny one)
  clock = () => Date.now(),
}) {
  let st = { status: 'loading', userId: null, username: null, ring: [], version: 0, notice: null };
  let settleWaiters = [];
  const subs = new Set();
  const keyCache = new Map(); // userId -> { keys: base64[], at }
  const mediaCache = new Map(); // fileUrl -> Promise<objectUrl>

  // == state ==================================================================

  function emit(patch) {
    st = { ...st, ...patch };
    if (st.status !== 'loading') {
      settleWaiters.forEach((r) => r());
      settleWaiters = [];
    }
    subs.forEach((fn) => fn(st));
  }

  const settled = () =>
    st.status !== 'loading'
      ? Promise.resolve()
      : Promise.race([
          new Promise((r) => settleWaiters.push(r)),
          new Promise((r) => setTimeout(r, SETTLE_TIMEOUT_MS)),
        ]);

  const ownPublics = () => st.ring.map((p) => b64(p.publicKey));

  // == setting up the account's keys ==========================================

  // `authoritative` is false when the server's key list couldn't be fetched and we only know the
  // account's current key: never wipe local (retired) keys on that basis.
  async function fetchMyKeys(user) {
    try {
      const list = await api.getMyKeys();
      return { keys: list.map((k) => k.publicKey), authoritative: true }; // current first
    } catch {
      return { keys: user.publicKey ? [user.publicKey] : [], authoritative: false };
    }
  }

  /** Works out this browser's status for the logged-in user. Safe to call again. */
  async function init(user) {
    mediaCache.clear();
    keyCache.clear();
    emit({ status: 'loading', userId: user.id, username: user.username, ring: [], notice: null });
    const { keys: serverKeys, authoritative } = await fetchMyKeys(user);

    let ring = await store.load(user.id);
    if (!ring && user.username) {
      const pending = await store.takePending(user.username); // key made at sign-up
      if (pending && serverKeys.includes(b64(pending[0].publicKey))) {
        ring = pending;
        await store.save(user.id, ring);
      }
    }

    if (serverKeys.length === 0) {
      emit({ status: 'needs-setup', ring: ring || [], version: st.version + 1 });
      return;
    }

    const valid = !ring ? [] : authoritative ? pruneRing(ring, serverKeys) : ring; // prune wipes keys past their 30 days
    const idx = valid.findIndex((p) => b64(p.publicKey) === serverKeys[0]);
    if (idx === -1) {
      if (ring && valid.length !== ring.length) await store.save(user.id, valid);
      emit({ status: 'needs-restore', ring: valid, version: st.version + 1 });
      return;
    }
    const ordered = [valid[idx], ...valid.filter((_, i) => i !== idx)];
    if (!ring || ordered.length !== ring.length || idx !== 0) await store.save(user.id, ordered);
    emit({ status: 'ready', ring: ordered, version: st.version + 1 });
  }

  function reset() {
    mediaCache.clear();
    keyCache.clear();
    emit({ status: 'loading', userId: null, username: null, ring: [], notice: null });
  }

  /** Makes a new key pair and registers it as the account's current key (needs the password). */
  async function createNewKey(password) {
    const pair = generateKeyPair();
    await api.rotateKey(b64(pair.publicKey), password); // throws on a wrong password
    const ring = [pair, ...st.ring];
    await store.save(st.userId, ring);
    emit({ status: 'ready', ring, notice: null, version: st.version + 1 });
  }

  /** Loads the account's keys from a .dat backup file made by this account. */
  async function restoreFromBackup({ bytes, passphrase }) {
    const { keys: serverKeys } = await fetchMyKeys({ publicKey: null });
    if (!serverKeys.length) throw new Error('Your account has no encryption key to restore.');
    const result = restoreBackup(bytes, {
      passphrase,
      expectedUserId: Number(st.userId),
      expectedPublicKeys: serverKeys.map(unb64),
    });
    const ring = result.secretKeys.map((sk) => ({ secretKey: sk, publicKey: nacl.box.keyPair.fromSecretKey(sk).publicKey }));
    await store.save(st.userId, ring);
    if (result.currentKeyRestored) {
      emit({ status: 'ready', ring, notice: null, version: st.version + 1 });
    } else {
      // Only retired keys came back (the backup predates a reroll). They still open older
      // messages for now, but the account needs a new current key to receive new ones.
      emit({ status: 'needs-restore', ring, notice: 'old-keys-only', version: st.version + 1 });
    }
    return { currentKeyRestored: result.currentKeyRestored };
  }

  /** A .dat file with this browser's key ring, protected by a passphrase. */
  function exportKeyBackup(passphrase) {
    if (st.status !== 'ready') throw new Error('Encryption is not set up on this browser.');
    return createBackup({
      userId: Number(st.userId),
      secretKeys: st.ring.map((p) => p.secretKey),
      data: {},
      passphrase,
      ...(backupKdf ? { kdf: backupKdf } : {}),
    });
  }

  // == finding other people's keys ============================================

  async function peerKeys(userId, { fresh = false } = {}) {
    const id = String(userId);
    const hit = keyCache.get(id);
    if (!fresh && hit && clock() - hit.at < (hit.keys.length ? KEY_TTL_MS : EMPTY_TTL_MS)) return hit.keys;
    let keys = [];
    try {
      keys = (await api.getUserKeys(userId)).map((k) => k.publicKey); // current first
    } catch {
      try {
        const u = await api.getUser(userId);
        if (u && u.publicKey) keys = [u.publicKey];
      } catch { /* leave empty: treated as "no key" */ }
    }
    keyCache.set(id, { keys, at: clock() });
    return keys;
  }

  /** [{id, publicKey}] for every member (me included), or null if anyone has no key. */
  async function memberKeys(conv) {
    const me = Number(st.userId);
    const ids = new Set((conv.members || []).map((m) => Number(m.id)));
    ids.add(me);
    const out = [];
    for (const id of ids) {
      const keys = id === me ? [b64(st.ring[0].publicKey)] : await peerKeys(id);
      if (!keys.length) return null;
      out.push({ id, publicKey: keys[0] });
    }
    return out;
  }

  // == receiving ==============================================================

  function failed(msg) {
    return {
      ...msg,
      content: msg.nonce && msg.content ? UNDECRYPTABLE_TEXT : msg.content,
      replyPreview: msg.replyPreviewNonce && msg.replyPreview ? '🔒' : msg.replyPreview,
      _undecryptable: true,
    };
  }

  async function tryDecrypt(msg, fresh) {
    if (msg.groupId) {
      const senderKeys = String(msg.senderId) === String(st.userId) ? ownPublics() : await peerKeys(msg.senderId, { fresh });
      const r = decryptGroupText(msg, st.userId, senderKeys, st.ring);
      return r && { ...msg, ...r, _enc: true };
    }
    const peerId = String(msg.senderId) === String(st.userId) ? msg.receiverId : msg.senderId;
    const keys = await peerKeys(peerId, { fresh });
    const out = { ...msg, _enc: true };
    if (msg.nonce && msg.content) {
      const text = decryptDmText(msg.content, msg.nonce, keys, st.ring);
      if (text == null) return null;
      out.content = text;
    }
    if (msg.replyPreviewNonce && msg.replyPreview) {
      const text = decryptDmText(msg.replyPreview, msg.replyPreviewNonce, keys, st.ring);
      out.replyPreview = text == null ? '🔒' : text;
    }
    return out;
  }

  /** Decrypts one message (DM or group, also EDIT frames). Plain messages pass through untouched. */
  async function decryptMessage(msg) {
    if (!msg || (!msg.nonce && !msg.replyPreviewNonce)) return msg;
    await settled();
    if (st.status !== 'ready') return failed(msg);
    try {
      const out = (await tryDecrypt(msg, false)) || (await tryDecrypt(msg, true)); // 2nd try: contact may have just rerolled
      return out || failed(msg);
    } catch {
      return failed(msg);
    }
  }

  async function decryptMessages(list) {
    return Promise.all((list || []).map(decryptMessage));
  }

  // == sending ================================================================

  /** Fields to put on a text message / edit payload. Throws EncryptionRequiredError if it can't be encrypted. */
  async function prepareText({ conv, content, replyPreview }) {
    if (st.status !== 'ready') throw new EncryptionRequiredError(NO_KEY_HERE);
    const secret = st.ring[0].secretKey;

    if (conv.isGroup) {
      const members = await memberKeys(conv);
      if (!members) throw new EncryptionRequiredError(NO_KEY_MEMBER);
      return { fields: encryptGroupMessage({ text: content, replyPreview, members, senderSecret: secret }), encrypted: true };
    }
    const keys = await peerKeys(conv.userId);
    if (!keys.length) throw new EncryptionRequiredError(NO_KEY_PEER);
    const fields = encryptDmText(content, keys[0], secret);
    if (replyPreview) {
      const r = encryptDmText(replyPreview, keys[0], secret);
      fields.replyPreview = r.content;
      fields.replyPreviewNonce = r.nonce;
    }
    return { fields, encrypted: true };
  }

  /** Encrypts a file for upload: returns the file to send plus the extra form fields. Throws if it can't. */
  async function prepareUpload({ conv, file, content, replyPreview }) {
    if (st.status !== 'ready') throw new EncryptionRequiredError(NO_KEY_HERE);
    const secret = st.ring[0].secretKey;
    const asFile = (bytes) => new File([bytes], file.name || 'file', { type: 'application/octet-stream' });

    let members = null;
    let peerKey = null;
    if (conv.isGroup) {
      members = await memberKeys(conv);
      if (!members) throw new EncryptionRequiredError(NO_KEY_MEMBER);
    } else {
      peerKey = (await peerKeys(conv.userId))[0];
      if (!peerKey) throw new EncryptionRequiredError(NO_KEY_PEER);
    }
    if (file.size > MAX_ENCRYPTED_FILE_BYTES) {
      throw new Error(`Files over ${Math.round(MAX_ENCRYPTED_FILE_BYTES / 1048576)} MB can't be sent encrypted yet.`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());

    if (members) {
      const f = encryptGroupFile(bytes, members, secret);
      const t = content || replyPreview
        ? encryptGroupMessage({ text: content, replyPreview, members, senderSecret: secret })
        : { recipientKeys: [] };
      const fields = { mediaNonce: f.mediaNonce, recipientKeysJson: JSON.stringify([...t.recipientKeys, ...f.recipientKeys]) };
      ['content', 'nonce', 'replyPreview', 'replyPreviewNonce'].forEach((k) => { if (t[k]) fields[k] = t[k]; });
      return { file: asFile(f.bytes), fields, encrypted: true };
    }

    const f = encryptDmFile(bytes, peerKey, secret);
    const fields = { mediaNonce: f.mediaNonce, mediaKeyCiphertext: f.mediaKeyCiphertext, mediaKeyNonce: f.mediaKeyNonce };
    if (content) Object.assign(fields, encryptDmText(content, peerKey, secret));
    if (replyPreview) {
      const r = encryptDmText(replyPreview, peerKey, secret);
      fields.replyPreview = r.content;
      fields.replyPreviewNonce = r.nonce;
    }
    return { file: asFile(f.bytes), fields, encrypted: true };
  }

  // == encrypted files ========================================================

  async function decryptFileBytes(msg, encBytes, fresh) {
    if (msg.groupId) {
      const senderKeys = String(msg.senderId) === String(st.userId) ? ownPublics() : await peerKeys(msg.senderId, { fresh });
      return decryptGroupFile(encBytes, msg, st.userId, senderKeys, st.ring);
    }
    const peerId = String(msg.senderId) === String(st.userId) ? msg.receiverId : msg.senderId;
    return decryptDmFile(encBytes, msg, await peerKeys(peerId, { fresh }), st.ring);
  }

  /**
   * Browser URL for a message's file: the decrypted file for an encrypted message (downloaded,
   * decrypted in memory, served as a blob URL), or just the resolved URL for a plain one.
   */
  function mediaUrl(msg) {
    if (!msg || !msg.fileUrl) return Promise.resolve(null);
    const raw = resolveFileUrl(msg.fileUrl);
    if (!msg.mediaNonce) return Promise.resolve(raw);
    const cacheKey = `${msg.fileUrl}|${msg.mediaNonce}`;
    if (!mediaCache.has(cacheKey)) {
      const p = (async () => {
        await settled();
        if (st.status !== 'ready') throw new Error('Encryption key not available');
        const enc = await fetchBytes(raw);
        const plain = (await decryptFileBytes(msg, enc, false)) || (await decryptFileBytes(msg, enc, true));
        if (!plain) throw new Error('Unable to decrypt this file');
        return makeObjectUrl(plain, guessMime(msg.fileUrl, msg.type));
      })();
      p.catch(() => mediaCache.delete(cacheKey)); // allow a retry (e.g. after restoring the key)
      mediaCache.set(cacheKey, p);
    }
    return mediaCache.get(cacheKey);
  }

  return {
    getState: () => st,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    init, reset,
    createNewKey, restoreFromBackup, exportKeyBackup,
    peerKeys, decryptMessage, decryptMessages,
    prepareText, prepareUpload, mediaUrl,
    /** Synchronous URL for a message file that is not encrypted. */
    plainFileUrl: (msg) => (msg && msg.fileUrl ? resolveFileUrl(msg.fileUrl) : null),
  };
}
