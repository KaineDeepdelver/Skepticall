/** @jest-environment node */
import nacl from 'tweetnacl';
import {
  decryptDmFile, decryptDmText, decryptGroupFile, decryptGroupText,
  encryptDmFile, encryptDmText, encryptGroupFile, encryptGroupMessage, guessMime, b64,
} from './box';

const pair = () => nacl.box.keyPair();
const ringOf = (...pairs) => pairs;
const pub = (p) => b64(p.publicKey);

describe('direct messages', () => {
  const alice = pair();
  const bob = pair();

  test('the recipient can read it, and so can the sender', () => {
    const { content, nonce } = encryptDmText('meet at 6 ✓', pub(bob), alice.secretKey);

    expect(decryptDmText(content, nonce, [pub(alice)], ringOf(bob))).toBe('meet at 6 ✓');
    expect(decryptDmText(content, nonce, [pub(bob)], ringOf(alice))).toBe('meet at 6 ✓');
  });

  test('the ciphertext does not contain the text', () => {
    const { content } = encryptDmText('very secret words', pub(bob), alice.secretKey);

    expect(content).not.toContain('secret');
    expect(Buffer.from(content, 'base64').toString('latin1')).not.toContain('secret');
  });

  test('someone else cannot read it', () => {
    const { content, nonce } = encryptDmText('hi', pub(bob), alice.secretKey);

    expect(decryptDmText(content, nonce, [pub(alice)], ringOf(pair()))).toBeNull();
  });

  test('a changed ciphertext or a wrong nonce is rejected', () => {
    const { content, nonce } = encryptDmText('hi', pub(bob), alice.secretKey);
    const raw = Buffer.from(content, 'base64');
    raw[0] ^= 1;

    expect(decryptDmText(raw.toString('base64'), nonce, [pub(alice)], ringOf(bob))).toBeNull();
    expect(decryptDmText(content, 'AAAA', [pub(alice)], ringOf(bob))).toBeNull();
  });

  test('every message gets a fresh nonce', () => {
    const a = encryptDmText('same', pub(bob), alice.secretKey);
    const b = encryptDmText('same', pub(bob), alice.secretKey);

    expect(a.nonce).not.toBe(b.nonce);
    expect(a.content).not.toBe(b.content);
  });

  test('a message to an older key still opens from the key ring', () => {
    const bobOld = pair();
    const bobNew = pair();
    const { content, nonce } = encryptDmText('sent before the reroll', pub(bobOld), alice.secretKey);

    expect(decryptDmText(content, nonce, [pub(alice)], ringOf(bobNew, bobOld))).toBe('sent before the reroll');
    expect(decryptDmText(content, nonce, [pub(alice)], ringOf(bobNew))).toBeNull();
  });

  test('files round trip and are not readable on the wire', () => {
    const file = Uint8Array.from({ length: 5000 }, (_, i) => i % 251);
    const enc = encryptDmFile(file, pub(bob), alice.secretKey);

    expect(Buffer.from(enc.bytes).equals(Buffer.from(file))).toBe(false);
    const plain = decryptDmFile(enc.bytes, enc, [pub(alice)], ringOf(bob));
    expect(Buffer.from(plain).equals(Buffer.from(file))).toBe(true);
    expect(decryptDmFile(enc.bytes, enc, [pub(alice)], ringOf(pair()))).toBeNull();
  });
});

describe('group messages', () => {
  const [a, b, c, outsider] = [pair(), pair(), pair(), pair()];
  const members = [a, b, c].map((p, i) => ({ id: i + 1, publicKey: pub(p) }));

  test('every member can read it, an outsider cannot', () => {
    const m = encryptGroupMessage({ text: 'hello group', replyPreview: 'earlier text', members, senderSecret: a.secretKey });
    const msg = { ...m };

    expect(m.recipientKeys).toHaveLength(3);
    for (const [i, p] of [a, b, c].entries()) {
      expect(decryptGroupText(msg, i + 1, [pub(a)], ringOf(p))).toEqual({ content: 'hello group', replyPreview: 'earlier text' });
    }
    expect(decryptGroupText(msg, 4, [pub(a)], ringOf(outsider))).toBeNull();
  });

  test('the text is encrypted once, the key is wrapped once per member', () => {
    const m = encryptGroupMessage({ text: 'x', members, senderSecret: a.secretKey });

    expect(new Set(m.recipientKeys.map((k) => k.wrappedKey)).size).toBe(3);
    expect(m.recipientKeys.every((k) => k.keyType === 'CONTENT')).toBe(true);
  });

  test('a media-only message needs no content key', () => {
    expect(encryptGroupMessage({ members, senderSecret: a.secretKey }).recipientKeys).toEqual([]);
  });

  test('group files round trip for members only', () => {
    const file = Uint8Array.from({ length: 3000 }, (_, i) => (i * 7) % 256);
    const enc = encryptGroupFile(file, members, a.secretKey);

    const plain = decryptGroupFile(enc.bytes, enc, 2, [pub(a)], ringOf(b));
    expect(Buffer.from(plain).equals(Buffer.from(file))).toBe(true);
    expect(decryptGroupFile(enc.bytes, enc, 4, [pub(a)], ringOf(outsider))).toBeNull();
    expect(enc.recipientKeys.every((k) => k.keyType === 'MEDIA')).toBe(true);
  });
});

describe('file types', () => {
  test('are guessed from the stored name and the message type', () => {
    expect(guessMime('/files/abc.JPG', 'IMAGE')).toBe('image/jpeg');
    expect(guessMime('https://cdn/x/clip.mp4?sig=1', 'VIDEO')).toBe('video/mp4');
    expect(guessMime('/f/voice_1.webm', 'VOICE')).toBe('audio/webm');
    expect(guessMime('/f/video.webm', 'VIDEO')).toBe('video/webm');
    expect(guessMime('/f/unknown.bin', 'FILE')).toBe('application/octet-stream');
  });
});
