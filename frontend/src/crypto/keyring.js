/**
 * Client-side key ring for rerolled keys.
 *
 * A ring is an array of { publicKey, secretKey } (Uint8Array(32) each), newest FIRST:
 * ring[0] is the current key. When the account rerolls, the old pair stays in the ring so
 * messages encrypted to it (by senders with a stale cached key, or queued while this device
 * was offline) can still be opened. The server decides how long an old key stays valid
 * (30 days after it is replaced); call pruneRing() with its list to drop expired ones.
 *
 * Nothing here talks to the server or storage. The app is responsible for:
 *   1. rerollRing() -> POST /users/me/public-key/rotate { publicKey, password }
 *      and only then persist the new ring (if the request fails, keep the old ring);
 *   2. after login and about once a day: GET /users/me/public-keys -> pruneRing();
 *   3. opening incoming messages with openBox(), passing the sender's valid keys from
 *      GET /users/{id}/public-keys.
 */
import nacl from 'tweetnacl';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';

export const GRACE_DAYS = 30; // informational: the server is the authority on expiry

function toBytes(key) {
  return typeof key === 'string' ? decodeBase64(key) : key;
}

function sameBytes(a, b) {
  return a.length === b.length && nacl.verify(a, b);
}

export function generateKeyPair() {
  const { publicKey, secretKey } = nacl.box.keyPair();
  return { publicKey, secretKey };
}

/**
 * Returns a NEW ring with a fresh current key in front (the input ring is not changed), plus
 * the base64 public key to send to the server.
 */
export function rerollRing(ring) {
  const pair = generateKeyPair();
  return { ring: [pair, ...ring], publicKeyBase64: encodeBase64(pair.publicKey) };
}

/**
 * Keeps only the pairs whose public key is in `validPublicKeys` (base64 strings, as the
 * server returns them, or Uint8Arrays) and wipes the private keys of the rest. Order is kept.
 */
export function pruneRing(ring, validPublicKeys) {
  const valid = validPublicKeys.map(toBytes);
  const kept = [];
  for (const pair of ring) {
    if (valid.some((v) => sameBytes(pair.publicKey, v))) kept.push(pair);
    else pair.secretKey.fill(0);
  }
  return kept;
}

/**
 * Opens a nacl.box message, trying every (sender key, recipient key) combination, newest
 * first. Handles both sides rerolling: the sender may have used an older key, and the message
 * may have been encrypted to one of our older keys.
 *
 * @returns {{ plaintext: Uint8Array, recipientKey: Uint8Array, senderKey: Uint8Array } | null}
 *   null when no combination works (keys expired, or the message isn't for us).
 */
export function openBox({ ciphertext, nonce, senderPublicKeys, ring }) {
  for (const sender of senderPublicKeys) {
    const senderKey = toBytes(sender);
    for (const pair of ring) {
      const plaintext = nacl.box.open(ciphertext, nonce, senderKey, pair.secretKey);
      if (plaintext) return { plaintext, recipientKey: pair.publicKey, senderKey };
    }
  }
  return null;
}
