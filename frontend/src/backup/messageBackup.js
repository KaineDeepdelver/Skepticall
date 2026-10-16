/**
 * Message backup (.dat) sealed to the ACCOUNT'S OWN KEY PAIR: no passphrase.
 *
 *   data (JSON) ──gzip──▶ secretbox(dataKey) ──▶ header + ciphertext
 *   dataKey = HKDF(K, info = header)        K = random 32 bytes
 *   K is stored in the header as box(K, nonce, accountPublic, accountSecret)
 *
 * Which key does what:
 *   - Making a backup needs the account's private key (so nobody who only knows the public key,
 *     which every user can fetch, can forge a backup that the account would accept).
 *   - Opening one needs the account's private key. The file contains no private key and no
 *     passphrase, so it can be copied or shared anywhere: without the key it is unreadable.
 *   - It opens on ANY device that has the account's key (restored with the key backup from
 *     backupFile.js). Nothing here is tied to a device.
 *   - Restore also checks the logged-in account: same user id, and the key the backup was sealed
 *     to must be one the server still lists as valid for that account (a rerolled key stays valid
 *     for 30 days).
 *
 * File layout (big-endian):
 *    0..3    magic "SKMB"
 *    4       format version (1)
 *    5..12   user id (u64)
 *    13..44  public key the backup is sealed to
 *    45..68  nonce for the wrapped key
 *    69..116 wrapped key K (32 bytes + 16-byte tag)
 *    117..140 nonce for the data
 *    141..   ciphertext of gzip(JSON)
 */
import nacl from 'tweetnacl';
import { decodeUTF8, encodeUTF8 } from 'tweetnacl-util';
import pako from 'pako';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { BackupError, BackupErrorCode, MAX_PLAINTEXT_BYTES, gunzipChecked } from './backupFile';

const MAGIC = [0x53, 0x4b, 0x4d, 0x42]; // "SKMB"
const VERSION = 1;
const HEADER_LENGTH = 141;
const TWO_32 = 4294967296;
const HKDF_SALT = decodeUTF8('skepticall-message-backup-v1');

function sameBytes(a, b) {
  return a.length === b.length && nacl.verify(a, b);
}

function assertKey(key, name, length) {
  if (!(key instanceof Uint8Array) || key.length !== length) {
    throw new TypeError(`${name} must be a Uint8Array of ${length} bytes`);
  }
}

function assertUserId(userId) {
  if (!Number.isSafeInteger(userId) || userId < 0) throw new TypeError('userId must be a non-negative integer');
}

function parseHeader(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length <= HEADER_LENGTH || MAGIC.some((b, i) => bytes[i] !== b)) {
    throw new BackupError(BackupErrorCode.BAD_FORMAT, 'This is not a Skepticall message backup.');
  }
  if (bytes[4] !== VERSION) {
    throw new BackupError(BackupErrorCode.UNSUPPORTED_VERSION, `Backup format version ${bytes[4]} is not supported by this app version.`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    header: bytes.slice(0, HEADER_LENGTH),
    userId: view.getUint32(5) * TWO_32 + view.getUint32(9),
    publicKey: bytes.slice(13, 45),
    keyNonce: bytes.slice(45, 69),
    wrappedKey: bytes.slice(69, 117),
    dataNonce: bytes.slice(117, 141),
    ciphertext: bytes.slice(HEADER_LENGTH),
  };
}

const deriveDataKey = (key, header) => hkdf(sha256, key, HKDF_SALT, header, 32);

/**
 * @param {object} args
 * @param {number} args.userId  the account making the backup
 * @param {{publicKey: Uint8Array, secretKey: Uint8Array}} args.keyPair  the account's CURRENT key pair
 * @param {*}      args.data    anything JSON-serialisable (the messages)
 * @returns {Uint8Array} the .dat file
 */
export function createMessageBackup({ userId, keyPair, data }) {
  assertUserId(userId);
  assertKey(keyPair && keyPair.publicKey, 'keyPair.publicKey', nacl.box.publicKeyLength);
  assertKey(keyPair.secretKey, 'keyPair.secretKey', nacl.box.secretKeyLength);

  const json = decodeUTF8(JSON.stringify({ format: 1, createdAt: new Date().toISOString(), userId, data }));
  if (json.length > MAX_PLAINTEXT_BYTES) throw new BackupError(BackupErrorCode.TOO_LARGE, 'There is too much data to back up.');

  const key = nacl.randomBytes(32);
  const keyNonce = nacl.randomBytes(nacl.box.nonceLength);
  const dataNonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const wrappedKey = nacl.box(key, keyNonce, keyPair.publicKey, keyPair.secretKey); // to myself

  const header = new Uint8Array(HEADER_LENGTH);
  const view = new DataView(header.buffer);
  header.set(MAGIC, 0);
  header[4] = VERSION;
  view.setUint32(5, Math.floor(userId / TWO_32));
  view.setUint32(9, userId % TWO_32);
  header.set(keyPair.publicKey, 13);
  header.set(keyNonce, 45);
  header.set(wrappedKey, 69);
  header.set(dataNonce, 117);

  const dataKey = deriveDataKey(key, header);
  const sealed = nacl.secretbox(pako.gzip(json), dataNonce, dataKey); // compress first, then encrypt
  key.fill(0);
  dataKey.fill(0);

  const out = new Uint8Array(HEADER_LENGTH + sealed.length);
  out.set(header, 0);
  out.set(sealed, HEADER_LENGTH);
  return out;
}

/** Unauthenticated header info, for showing "this backup belongs to account #12" before restoring. */
export function peekMessageBackup(bytes) {
  const { userId, publicKey } = parseHeader(bytes);
  return { version: VERSION, userId, publicKey };
}

/**
 * Opens a message backup. Throws BackupError unless the backup belongs to the logged-in account
 * AND this device holds the key it was sealed to.
 *
 * @param {Uint8Array} bytes
 * @param {object}     args
 * @param {number}     args.expectedUserId   id of the logged-in account
 * @param {Array<{publicKey: Uint8Array, secretKey: Uint8Array}>} args.ring  this device's key ring
 * @param {Uint8Array[]} args.validPublicKeys  keys the server lists as valid for the account (current first)
 * @returns {{ data: *, createdAt: string, publicKey: Uint8Array }}
 */
export function restoreMessageBackup(bytes, { expectedUserId, ring, validPublicKeys }) {
  assertUserId(expectedUserId);
  const parsed = parseHeader(bytes);

  if (parsed.userId !== expectedUserId) {
    throw new BackupError(BackupErrorCode.WRONG_ACCOUNT, 'This backup belongs to a different account.');
  }
  if (!(validPublicKeys || []).some((k) => sameBytes(k, parsed.publicKey))) {
    throw new BackupError(
      BackupErrorCode.KEYS_NO_LONGER_VALID,
      'The key this backup was made with is no longer valid for your account (it was rerolled more than 30 days ago).'
    );
  }
  const pair = (ring || []).find((p) => sameBytes(p.publicKey, parsed.publicKey));
  if (!pair) {
    throw new BackupError(BackupErrorCode.KEY_NOT_ON_DEVICE, 'This device does not have the key for this backup. Restore your key backup first.');
  }

  const key = nacl.box.open(parsed.wrappedKey, parsed.keyNonce, pair.publicKey, pair.secretKey);
  if (!key) {
    throw new BackupError(BackupErrorCode.WRONG_PASSPHRASE_OR_CORRUPT, 'The backup is damaged or was not made by this account.');
  }
  const dataKey = deriveDataKey(key, parsed.header);
  key.fill(0);
  const compressed = nacl.secretbox.open(parsed.ciphertext, parsed.dataNonce, dataKey);
  dataKey.fill(0);
  if (!compressed) {
    throw new BackupError(BackupErrorCode.WRONG_PASSPHRASE_OR_CORRUPT, 'The backup is damaged.');
  }

  let inner;
  try {
    inner = JSON.parse(encodeUTF8(gunzipChecked(compressed)));
  } catch (e) {
    if (e instanceof BackupError) throw e;
    throw new BackupError(BackupErrorCode.WRONG_PASSPHRASE_OR_CORRUPT, 'The backup is corrupted.');
  }
  if (inner.userId !== expectedUserId) {
    throw new BackupError(BackupErrorCode.WRONG_ACCOUNT, 'This backup belongs to a different account.');
  }
  return { data: inner.data, createdAt: inner.createdAt, publicKey: parsed.publicKey };
}
