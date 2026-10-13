/** @jest-environment node */
import nacl from 'tweetnacl';
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { generateKeyPair, openBox, pruneRing, rerollRing } from './keyring';

const MESSAGE = 'meet at 6';

/** Encrypts `text` from a sender key pair to a recipient public key, like the app does. */
function seal(text, recipientPublicKey, senderSecretKey) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  return { nonce, ciphertext: nacl.box(decodeUTF8(text), nonce, recipientPublicKey, senderSecretKey) };
}

describe('key ring', () => {
  test('rerolling puts a fresh key first and keeps the old ones', () => {
    const ring = [generateKeyPair()];

    const { ring: next, publicKeyBase64 } = rerollRing(ring);

    expect(next).toHaveLength(2);
    expect(next[1]).toBe(ring[0]);
    expect(ring).toHaveLength(1); // input not changed
    expect(decodeBase64(publicKeyBase64)).toHaveLength(32);
    expect(encodeBase64(next[0].publicKey)).toBe(publicKeyBase64);
  });

  test('a message encrypted to the OLD key still opens after rerolling', () => {
    const sender = generateKeyPair();
    const before = [generateKeyPair()];
    const sealed = seal(MESSAGE, before[0].publicKey, sender.secretKey); // sent with the stale key
    const { ring: after } = rerollRing(before);

    const opened = openBox({ ...sealed, senderPublicKeys: [sender.publicKey], ring: after });

    expect(encodeUTF8(opened.plaintext)).toBe(MESSAGE);
    expect(Buffer.from(opened.recipientKey).equals(Buffer.from(before[0].publicKey))).toBe(true);
  });

  test('a message from a sender who has since rerolled opens with their old public key', () => {
    const recipient = generateKeyPair();
    const senderOld = generateKeyPair();
    const senderNew = generateKeyPair();
    const sealed = seal(MESSAGE, recipient.publicKey, senderOld.secretKey);

    const opened = openBox({
      ...sealed,
      senderPublicKeys: [encodeBase64(senderNew.publicKey), encodeBase64(senderOld.publicKey)], // as the server returns them
      ring: [recipient],
    });

    expect(encodeUTF8(opened.plaintext)).toBe(MESSAGE);
  });

  test('opening fails once the old key has been pruned', () => {
    const sender = generateKeyPair();
    const before = [generateKeyPair()];
    const sealed = seal(MESSAGE, before[0].publicKey, sender.secretKey);
    const { ring: after } = rerollRing(before);

    // 30 days later the server only lists the new key
    const pruned = pruneRing(after, [encodeBase64(after[0].publicKey)]);

    expect(pruned).toHaveLength(1);
    expect(openBox({ ...sealed, senderPublicKeys: [sender.publicKey], ring: pruned })).toBeNull();
  });

  test('pruning wipes the private key of an expired pair', () => {
    const { ring } = rerollRing([generateKeyPair()]);
    const expired = ring[1];

    pruneRing(ring, [ring[0].publicKey]);

    expect(Array.from(expired.secretKey).every((b) => b === 0)).toBe(true);
  });

  test('a message that is not for us does not open', () => {
    const sender = generateKeyPair();
    const stranger = generateKeyPair();
    const sealed = seal(MESSAGE, stranger.publicKey, sender.secretKey);

    expect(openBox({ ...sealed, senderPublicKeys: [sender.publicKey], ring: [generateKeyPair()] })).toBeNull();
  });
});
