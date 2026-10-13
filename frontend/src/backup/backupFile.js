/**
 * Skepticall backup file (.dat): compressed, then encrypted.
 *
 *   plaintext JSON ──gzip──▶ secretbox (XSalsa20-Poly1305) ──▶ header + ciphertext
 *
 * Who can use a backup:
 *   - Reading it needs the passphrase it was created with (Argon2id -> HKDF -> key).
 *     The file can be copied, emailed or stored anywhere; without the passphrase it is
 *     just random bytes.
 *   - Restoring it needs the SAME account. The backup carries the account's private keys
 *     (its key ring: the current key plus recently retired ones), and restore refuses
 *     unless at least one of them matches a public key the server currently lists as valid
 *     for the logged-in account (and the user ids match). A backup made by account A
 *     therefore can't be loaded into account B, even by someone who knows the passphrase.
 *   - Rerolled keys: a retired key stays valid for 30 days (the server's call). A backup
 *     holding only retired keys restores until then; restore keeps only the keys that are
 *     still valid and tells you whether the account's CURRENT key came back.
 *   - The header (version, KDF settings, salt, nonce, user id) is bound into the key via
 *     HKDF "info", so editing any header byte makes decryption fail.
 *
 * File layout (big-endian):
 *    0..3   magic "SKBK"
 *    4      format version (2)
 *    5      KDF id (1 = Argon2id)
 *    6      Argon2 iterations t
 *    7..10  Argon2 memory in KiB
 *    11     Argon2 parallelism p (always 1)
 *    12..27 salt (16 bytes)
 *    28..51 secretbox nonce (24 bytes)
 *    52..59 user id (u64, a hint for the UI; re-checked after decryption)
 *    60..   ciphertext (gzip(JSON) sealed with secretbox)
 *
 * Works in browsers, React Native and Node (needs a secure random source for
 * nacl.randomBytes; React Native needs a getRandomValues polyfill).
 */
import nacl from 'tweetnacl';
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';
import pako from 'pako';
import { argon2id } from '@noble/hashes/argon2';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

export const BackupErrorCode = Object.freeze({
  BAD_FORMAT: 'BAD_FORMAT',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  WEAK_PASSPHRASE: 'WEAK_PASSPHRASE',
  WRONG_PASSPHRASE_OR_CORRUPT: 'WRONG_PASSPHRASE_OR_CORRUPT',
  WRONG_ACCOUNT: 'WRONG_ACCOUNT',
  TOO_LARGE: 'TOO_LARGE',
  KEYS_NO_LONGER_VALID: 'KEYS_NO_LONGER_VALID',
});

export class BackupError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BackupError';
    this.code = code;
  }
}

const MAGIC = [0x53, 0x4b, 0x42, 0x4b]; // "SKBK"
const VERSION = 2;
const KDF_ARGON2ID = 1;
const HEADER_LENGTH = 60;
const SALT_LENGTH = 16;
const NONCE_LENGTH = nacl.secretbox.nonceLength; // 24
const HKDF_SALT = decodeUTF8('skepticall-backup-v1');

export const MIN_PASSPHRASE_LENGTH = 8;
export const MAX_PLAINTEXT_BYTES = 512 * 1024 * 1024; // refuse to inflate more than this
// Argon2id, OWASP's recommended minimum (2 passes, 19 MiB): ~0.5 s on a laptop in plain JS.
// Slow enough to hurt offline guessing, light enough for phones.
export const DEFAULT_KDF = Object.freeze({ t: 2, m: 19456 });
const MAX_KEYS_IN_RING = 32;
const MAX_KDF_T = 10;
const MAX_KDF_M_KIB = 262144; // 256 MiB: stops a crafted file from exhausting memory
const TWO_32 = 4294967296;

// == helpers ===================================================================

function normalizePassphrase(passphrase) {
  if (typeof passphrase !== 'string') {
    throw new BackupError(BackupErrorCode.WEAK_PASSPHRASE, 'A passphrase is required.');
  }
  return decodeUTF8(passphrase.normalize('NFKC'));
}

function assertUserId(userId) {
  if (!Number.isSafeInteger(userId) || userId < 0) {
    throw new TypeError('userId must be a non-negative integer');
  }
}

function assertKey(key, name, length) {
  if (!(key instanceof Uint8Array) || key.length !== length) {
    throw new TypeError(`${name} must be a Uint8Array of ${length} bytes`);
  }
}

function buildHeader({ t, m, salt, nonce, userId }) {
  const header = new Uint8Array(HEADER_LENGTH);
  const view = new DataView(header.buffer);
  header.set(MAGIC, 0);
  header[4] = VERSION;
  header[5] = KDF_ARGON2ID;
  header[6] = t;
  view.setUint32(7, m);
  header[11] = 1;
  header.set(salt, 12);
  header.set(nonce, 28);
  view.setUint32(52, Math.floor(userId / TWO_32));
  view.setUint32(56, userId % TWO_32);
  return header;
}

function parseHeader(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length <= HEADER_LENGTH) {
    throw new BackupError(BackupErrorCode.BAD_FORMAT, 'This is not a Skepticall backup file.');
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) {
      throw new BackupError(BackupErrorCode.BAD_FORMAT, 'This is not a Skepticall backup file.');
    }
  }
  if (bytes[4] !== VERSION) {
    throw new BackupError(
      BackupErrorCode.UNSUPPORTED_VERSION,
      `Backup format version ${bytes[4]} is not supported by this app version.`
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const t = bytes[6];
  const m = view.getUint32(7);
  const p = bytes[11];
  if (bytes[5] !== KDF_ARGON2ID || p !== 1 || t < 1 || t > MAX_KDF_T || m < 8 || m > MAX_KDF_M_KIB) {
    throw new BackupError(BackupErrorCode.BAD_FORMAT, 'This backup has invalid key-derivation settings.');
  }
  return {
    header: bytes.slice(0, HEADER_LENGTH),
    t,
    m,
    salt: bytes.slice(12, 12 + SALT_LENGTH),
    nonce: bytes.slice(28, 28 + NONCE_LENGTH),
    userId: view.getUint32(52) * TWO_32 + view.getUint32(56),
    ciphertext: bytes.slice(HEADER_LENGTH),
  };
}

/** passphrase -> Argon2id -> HKDF(info = header) -> 32-byte secretbox key */
function deriveKey(passphraseBytes, { t, m, salt }, header) {
  const master = argon2id(passphraseBytes, salt, { t, m, p: 1, dkLen: 32 });
  const key = hkdf(sha256, master, HKDF_SALT, header, 32);
  master.fill(0);
  return key;
}

function gunzipChecked(compressed) {
  // The last 4 bytes of a gzip stream hold the uncompressed size (little-endian).
  if (compressed.length >= 4) {
    const v = new DataView(compressed.buffer, compressed.byteOffset, compressed.byteLength);
    if (v.getUint32(compressed.length - 4, true) > MAX_PLAINTEXT_BYTES) {
      throw new BackupError(BackupErrorCode.TOO_LARGE, 'This backup is too large to restore.');
    }
  }
  try {
    return pako.ungzip(compressed);
  } catch {
    throw new BackupError(BackupErrorCode.WRONG_PASSPHRASE_OR_CORRUPT, 'The backup is corrupted.');
  }
}

function sameBytes(a, b) {
  return a.length === b.length && nacl.verify(a, b);
}

// == public API ================================================================

/**
 * Create a backup file.
 *
 * @param {object}     args
 * @param {number}       args.userId      id of the account creating the backup
 * @param {Uint8Array[]} args.secretKeys  that account's 32-byte X25519 private keys, newest
 *                                        (current) first; include retired keys still in their grace period
 * @param {*}          args.data        anything JSON-serialisable (messages, settings, ...)
 * @param {string}     args.passphrase  protects the file (min 8 characters)
 * @param {{t:number,m:number}} [args.kdf] Argon2id cost override (tests use tiny values)
 * @returns {Uint8Array} bytes to save as a .dat file
 */
export function createBackup({ userId, secretKeys, data, passphrase, kdf = DEFAULT_KDF }) {
  assertUserId(userId);
  if (!Array.isArray(secretKeys) || secretKeys.length < 1 || secretKeys.length > MAX_KEYS_IN_RING) {
    throw new TypeError(`secretKeys must be an array of 1 to ${MAX_KEYS_IN_RING} keys`);
  }
  secretKeys.forEach((k) => assertKey(k, 'secretKeys[]', nacl.box.secretKeyLength));
  const passphraseBytes = normalizePassphrase(passphrase);
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new BackupError(
      BackupErrorCode.WEAK_PASSPHRASE,
      `Use a passphrase of at least ${MIN_PASSPHRASE_LENGTH} characters.`
    );
  }

  const json = decodeUTF8(
    JSON.stringify({
      format: 2,
      createdAt: new Date().toISOString(),
      userId,
      secretKeys: secretKeys.map(encodeBase64),
      data,
    })
  );
  if (json.length > MAX_PLAINTEXT_BYTES) {
    throw new BackupError(BackupErrorCode.TOO_LARGE, 'There is too much data to back up.');
  }

  const salt = nacl.randomBytes(SALT_LENGTH);
  const nonce = nacl.randomBytes(NONCE_LENGTH);
  const header = buildHeader({ t: kdf.t, m: kdf.m, salt, nonce, userId });
  const key = deriveKey(passphraseBytes, { t: kdf.t, m: kdf.m, salt }, header);

  const sealed = nacl.secretbox(pako.gzip(json), nonce, key); // compress first, then encrypt
  key.fill(0);

  const out = new Uint8Array(HEADER_LENGTH + sealed.length);
  out.set(header, 0);
  out.set(sealed, HEADER_LENGTH);
  return out;
}

/**
 * Read the unauthenticated header: lets the UI say "this backup belongs to account #12"
 * before asking for a passphrase. Nothing here is secret or trusted.
 */
export function peekBackup(bytes) {
  const { t, m, userId } = parseHeader(bytes);
  return { version: VERSION, userId, kdf: { t, m } };
}

/**
 * Open a backup. Throws BackupError unless ALL of these hold:
 *   1. the passphrase is right and the file is intact,
 *   2. the backup was made by the account that is logged in now, and
 *   3. at least one key in its key ring is still valid for that account.
 *
 * @param {Uint8Array}   bytes
 * @param {object}       args
 * @param {string}       args.passphrase
 * @param {number}       args.expectedUserId      id of the logged-in account
 * @param {Uint8Array[]} args.expectedPublicKeys  the public keys the server lists as valid for that
 *                                                account (GET /users/me/public-keys), current key FIRST
 * @returns {{data: *, secretKeys: Uint8Array[], currentKeyRestored: boolean, userId: number, createdAt: string}}
 *   `secretKeys` holds only the keys that are still valid (newest first); expired ones are
 *   wiped. If `currentKeyRestored` is false the backup predates a reroll: the device has only
 *   retired keys, so reroll again from this device to be able to receive new messages.
 */
export function restoreBackup(bytes, { passphrase, expectedUserId, expectedPublicKeys }) {
  assertUserId(expectedUserId);
  if (!Array.isArray(expectedPublicKeys) || expectedPublicKeys.length < 1) {
    throw new TypeError('expectedPublicKeys must be a non-empty array');
  }
  expectedPublicKeys.forEach((k) => assertKey(k, 'expectedPublicKeys[]', nacl.box.publicKeyLength));
  const parsed = parseHeader(bytes);

  // Cheap early exit before the expensive key derivation. The header is not trusted
  // (it is re-checked after decryption), this is only a better error for the user.
  if (parsed.userId !== expectedUserId) {
    throw new BackupError(BackupErrorCode.WRONG_ACCOUNT, 'This backup belongs to a different account.');
  }

  const key = deriveKey(normalizePassphrase(passphrase), parsed, parsed.header);
  const compressed = nacl.secretbox.open(parsed.ciphertext, parsed.nonce, key);
  key.fill(0);
  if (!compressed) {
    throw new BackupError(
      BackupErrorCode.WRONG_PASSPHRASE_OR_CORRUPT,
      'Wrong passphrase, or the backup file is damaged.'
    );
  }

  let inner;
  try {
    inner = JSON.parse(encodeUTF8(gunzipChecked(compressed)));
  } catch (e) {
    if (e instanceof BackupError) throw e;
    throw new BackupError(BackupErrorCode.WRONG_PASSPHRASE_OR_CORRUPT, 'The backup is corrupted.');
  }

  let ring;
  try {
    if (!Array.isArray(inner.secretKeys) || inner.secretKeys.length < 1 || inner.secretKeys.length > MAX_KEYS_IN_RING) {
      throw new Error('bad ring');
    }
    ring = inner.secretKeys.map((b64) => {
      const k = decodeBase64(b64);
      assertKey(k, 'secretKey', nacl.box.secretKeyLength);
      return k;
    });
  } catch {
    throw new BackupError(BackupErrorCode.BAD_FORMAT, 'The backup contents are invalid.');
  }

  // Account binding, part 1: the user id inside the (authenticated) payload must match.
  if (inner.userId !== expectedUserId || inner.userId !== parsed.userId) {
    ring.forEach((k) => k.fill(0));
    throw new BackupError(BackupErrorCode.WRONG_ACCOUNT, 'This backup belongs to a different account.');
  }

  // Part 2: keep only the keys whose public half the server still lists as valid for this account.
  const publicKeys = ring.map((sk) => nacl.box.keyPair.fromSecretKey(sk).publicKey);
  const kept = [];
  ring.forEach((sk, i) => {
    if (expectedPublicKeys.some((valid) => sameBytes(publicKeys[i], valid))) kept.push(i);
    else sk.fill(0); // retired and past its grace period (or not this account's key): wipe
  });
  if (kept.length === 0) {
    throw new BackupError(
      BackupErrorCode.KEYS_NO_LONGER_VALID,
      'None of the keys in this backup are valid for your account any more (it was rerolled more than 30 days ago).'
    );
  }

  const currentKeyRestored = kept.some((i) => sameBytes(publicKeys[i], expectedPublicKeys[0]));
  return {
    data: inner.data,
    secretKeys: kept.map((i) => ring[i]),
    currentKeyRestored,
    userId: inner.userId,
    createdAt: inner.createdAt,
  };
}
