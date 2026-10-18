/**
 * Message-level crypto for the wire format the backend stores (see Message.java,
 * GroupMessage.java, GroupMessageKey.java). Pure functions: no network, no storage.
 *
 *  - Everything on the wire is standard base64.
 *  - Text and keys use NaCl `box` (X25519 + XSalsa20-Poly1305) between the sender's private key
 *    and the recipient's public key, with a fresh 24-byte nonce each time.
 *  - Files are sealed with a random 32-byte key (`secretbox`); that key is wrapped like text.
 *  - Groups: one random content key per message, wrapped separately for every member.
 *
 * Because box(recipientPub, senderSecret) and box(senderPub, recipientSecret) derive the same
 * shared key, the sender can open their own messages with the recipient's public key.
 */
import nacl from 'tweetnacl';
import { decodeBase64 as unb64, encodeBase64 as b64, decodeUTF8, encodeUTF8 } from 'tweetnacl-util';
import { openBox } from '../crypto/keyring';

export const MAX_ENCRYPTED_FILE_BYTES = 64 * 1024 * 1024;
const KEY_BYTES = nacl.secretbox.keyLength; // 32

const rnd = (n) => nacl.randomBytes(n);

function boxSeal(plain, recipientPubB64, senderSecret) {
  const nonce = rnd(nacl.box.nonceLength);
  return { nonce, ct: nacl.box(plain, nonce, unb64(recipientPubB64), senderSecret) };
}

function secretSeal(plain, key) {
  const nonce = rnd(nacl.secretbox.nonceLength);
  return { nonce, ct: nacl.secretbox(plain, nonce, key) };
}

// == Direct messages ===========================================================

export function encryptDmText(text, recipientPubB64, senderSecret) {
  const { nonce, ct } = boxSeal(decodeUTF8(text), recipientPubB64, senderSecret);
  return { content: b64(ct), nonce: b64(nonce) };
}

/** Returns the text, or null when no key combination opens it. */
export function decryptDmText(contentB64, nonceB64, peerKeysB64, ring) {
  try {
    const opened = openBox({
      ciphertext: unb64(contentB64),
      nonce: unb64(nonceB64),
      senderPublicKeys: peerKeysB64,
      ring,
    });
    return opened ? encodeUTF8(opened.plaintext) : null;
  } catch {
    return null;
  }
}

export function encryptDmFile(bytes, recipientPubB64, senderSecret) {
  const key = rnd(KEY_BYTES);
  const body = secretSeal(bytes, key);
  const wrap = boxSeal(key, recipientPubB64, senderSecret);
  key.fill(0);
  return {
    bytes: body.ct,
    mediaNonce: b64(body.nonce),
    mediaKeyCiphertext: b64(wrap.ct),
    mediaKeyNonce: b64(wrap.nonce),
  };
}

export function decryptDmFile(encBytes, { mediaNonce, mediaKeyCiphertext, mediaKeyNonce }, peerKeysB64, ring) {
  try {
    const key = openBox({
      ciphertext: unb64(mediaKeyCiphertext),
      nonce: unb64(mediaKeyNonce),
      senderPublicKeys: peerKeysB64,
      ring,
    });
    if (!key || key.plaintext.length !== KEY_BYTES) return null;
    const plain = nacl.secretbox.open(encBytes, unb64(mediaNonce), key.plaintext);
    key.plaintext.fill(0);
    return plain;
  } catch {
    return null;
  }
}

// == Group messages ============================================================

function wrapForMembers(key, keyType, members, senderSecret) {
  return members.map((m) => {
    const w = boxSeal(key, m.publicKey, senderSecret);
    return { recipientId: m.id, keyType, wrappedKey: b64(w.ct), wrappedKeyNonce: b64(w.nonce) };
  });
}

/**
 * Encrypts text (and an optional reply preview) once under a random content key and wraps that key
 * for every member. `members` is [{ id, publicKey(base64) }] and must include the sender.
 * Returns only the fields that apply: content, nonce, replyPreview, replyPreviewNonce, recipientKeys.
 */
export function encryptGroupMessage({ text, replyPreview, members, senderSecret }) {
  const out = { recipientKeys: [] };
  if (!text && !replyPreview) return out;
  const key = rnd(KEY_BYTES);
  if (text) {
    const s = secretSeal(decodeUTF8(text), key);
    out.content = b64(s.ct);
    out.nonce = b64(s.nonce);
  }
  if (replyPreview) {
    const s = secretSeal(decodeUTF8(replyPreview), key);
    out.replyPreview = b64(s.ct);
    out.replyPreviewNonce = b64(s.nonce);
  }
  out.recipientKeys = wrapForMembers(key, 'CONTENT', members, senderSecret);
  key.fill(0);
  return out;
}

export function encryptGroupFile(bytes, members, senderSecret) {
  const key = rnd(KEY_BYTES);
  const body = secretSeal(bytes, key);
  const recipientKeys = wrapForMembers(key, 'MEDIA', members, senderSecret);
  key.fill(0);
  return { bytes: body.ct, mediaNonce: b64(body.nonce), recipientKeys };
}

function unwrapGroupKey(recipientKeys, keyType, myUserId, senderKeysB64, ring) {
  const mine = (recipientKeys || []).find(
    (k) => String(k.recipientId) === String(myUserId) && k.keyType === keyType
  );
  if (!mine) return null;
  const opened = openBox({
    ciphertext: unb64(mine.wrappedKey),
    nonce: unb64(mine.wrappedKeyNonce),
    senderPublicKeys: senderKeysB64,
    ring,
  });
  return opened && opened.plaintext.length === KEY_BYTES ? opened.plaintext : null;
}

/** Returns { content, replyPreview } (only the encrypted fields present), or null on failure. */
export function decryptGroupText(msg, myUserId, senderKeysB64, ring) {
  try {
    const out = {};
    const hasContent = !!(msg.nonce && msg.content);
    const hasReply = !!(msg.replyPreviewNonce && msg.replyPreview);
    if (!hasContent && !hasReply) return out;
    const key = unwrapGroupKey(msg.recipientKeys, 'CONTENT', myUserId, senderKeysB64, ring);
    if (!key) return null;
    if (hasContent) {
      const p = nacl.secretbox.open(unb64(msg.content), unb64(msg.nonce), key);
      if (!p) return null;
      out.content = encodeUTF8(p);
    }
    if (hasReply) {
      const p = nacl.secretbox.open(unb64(msg.replyPreview), unb64(msg.replyPreviewNonce), key);
      out.replyPreview = p ? encodeUTF8(p) : '🔒';
    }
    key.fill(0);
    return out;
  } catch {
    return null;
  }
}

export function decryptGroupFile(encBytes, { mediaNonce, recipientKeys }, myUserId, senderKeysB64, ring) {
  try {
    const key = unwrapGroupKey(recipientKeys, 'MEDIA', myUserId, senderKeysB64, ring);
    if (!key) return null;
    const plain = nacl.secretbox.open(encBytes, unb64(mediaNonce), key);
    key.fill(0);
    return plain;
  } catch {
    return null;
  }
}

// == File type helper ==========================================================

const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  avif: 'image/avif', svg: 'image/svg+xml', bmp: 'image/bmp',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', m4v: 'video/mp4',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
  pdf: 'application/pdf', txt: 'text/plain', json: 'application/json', zip: 'application/zip',
};

/** Best MIME type for a decrypted file, from the stored file name and the message type. */
export function guessMime(fileUrl, messageType) {
  const name = String(fileUrl || '').split('?')[0].split('/').pop() || '';
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  const type = String(messageType || '').toUpperCase();
  if (type === 'VOICE' && (ext === 'webm' || ext === '' || ext === 'ogg')) return ext === 'ogg' ? 'audio/ogg' : 'audio/webm';
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

export { b64, unb64 };
