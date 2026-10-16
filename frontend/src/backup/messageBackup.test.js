/** @jest-environment node */
import nacl from 'tweetnacl';
import { decodeUTF8 } from 'tweetnacl-util';
import { BackupError, BackupErrorCode } from './backupFile';
import { createMessageBackup, peekMessageBackup, restoreMessageBackup } from './messageBackup';

const pair = () => nacl.box.keyPair();
const alice = { userId: 12, key: pair() };
const sample = { conversations: [{ with: 34, messages: [{ id: 1, text: 'hello world' }] }] };

const make = (acc = alice, data = sample) => createMessageBackup({ userId: acc.userId, keyPair: acc.key, data });
const open = (bytes, { userId = 12, ring = [alice.key], valid = [alice.key.publicKey] } = {}) =>
  restoreMessageBackup(bytes, { expectedUserId: userId, ring, validPublicKeys: valid });
const codeOf = (fn) => {
  try { fn(); } catch (e) { expect(e).toBeInstanceOf(BackupError); return e.code; }
  throw new Error('expected a BackupError');
};

describe('message backup sealed to the account key', () => {
  test('round trip, with no passphrase', () => {
    const r = open(make());

    expect(r.data).toEqual(sample);
    expect(Buffer.from(r.publicKey).equals(Buffer.from(alice.key.publicKey))).toBe(true);
  });

  test('the file is encrypted and compressed, and holds no private key', () => {
    const big = { m: Array.from({ length: 2000 }, (_, i) => ({ id: i, text: 'hello world, same text again' })) };
    const bytes = make(alice, big);
    const text = Buffer.from(bytes).toString('latin1');

    expect(text).not.toContain('hello world');
    expect(Buffer.from(bytes).includes(Buffer.from(alice.key.secretKey))).toBe(false);
    expect(bytes.length).toBeLessThan(decodeUTF8(JSON.stringify(big)).length * 0.2);
  });

  test('another device with the same key can open it', () => {
    const sameKeyOtherDevice = [{ publicKey: alice.key.publicKey, secretKey: Uint8Array.from(alice.key.secretKey) }];

    expect(open(make(), { ring: sameKeyOtherDevice }).data).toEqual(sample);
  });

  test('a device without the key cannot, and is told to restore the key first', () => {
    expect(codeOf(() => open(make(), { ring: [pair()] }))).toBe(BackupErrorCode.KEY_NOT_ON_DEVICE);
    expect(codeOf(() => open(make(), { ring: [] }))).toBe(BackupErrorCode.KEY_NOT_ON_DEVICE);
  });

  test("another account can't use it", () => {
    const bob = { userId: 99, key: pair() };

    expect(codeOf(() => open(make(), { userId: 99, ring: [bob.key], valid: [bob.key.publicKey] }))).toBe(
      BackupErrorCode.WRONG_ACCOUNT
    );
  });

  test('someone who only knows your public key cannot make a backup you would accept', () => {
    const attacker = pair();
    // the attacker seals to the victim's public key using their own secret key
    const forged = createMessageBackup({ userId: 12, keyPair: { publicKey: alice.key.publicKey, secretKey: attacker.secretKey }, data: { fake: true } });

    expect(codeOf(() => open(forged))).toBe(BackupErrorCode.WRONG_PASSPHRASE_OR_CORRUPT);
  });

  test('tampering with the header or the data is detected', () => {
    const a = make();
    a[60] ^= 1; // wrapped key
    const b = make();
    b[b.length - 3] ^= 1; // ciphertext
    const c = make();
    c[120] ^= 1; // data nonce (part of the header)

    for (const bytes of [a, b, c]) {
      expect(codeOf(() => open(bytes))).toBe(BackupErrorCode.WRONG_PASSPHRASE_OR_CORRUPT);
    }
  });

  test('works with a rerolled key while it is still valid, and stops after it expires', () => {
    const oldKey = pair();
    const newKey = pair();
    const bytes = createMessageBackup({ userId: 12, keyPair: oldKey, data: sample });
    const ring = [newKey, oldKey];

    expect(open(bytes, { ring, valid: [newKey.publicKey, oldKey.publicKey] }).data).toEqual(sample);
    expect(codeOf(() => open(bytes, { ring, valid: [newKey.publicKey] }))).toBe(BackupErrorCode.KEYS_NO_LONGER_VALID);
  });

  test('a file that is not a backup, a truncated file and an unknown version are rejected', () => {
    expect(codeOf(() => open(decodeUTF8('x'.repeat(300))))).toBe(BackupErrorCode.BAD_FORMAT);
    expect(codeOf(() => open(make().slice(0, 50)))).toBe(BackupErrorCode.BAD_FORMAT);
    const v2 = make();
    v2[4] = 2;
    expect(codeOf(() => open(v2))).toBe(BackupErrorCode.UNSUPPORTED_VERSION);
  });

  test('peek shows the owner and key without any secret', () => {
    const p = peekMessageBackup(make());

    expect(p.userId).toBe(12);
    expect(Buffer.from(p.publicKey).equals(Buffer.from(alice.key.publicKey))).toBe(true);
  });

  test('two backups of the same data differ, and big user ids survive', () => {
    const big = { userId: 2 ** 40 + 5, key: alice.key };

    expect(Buffer.from(make()).equals(Buffer.from(make()))).toBe(false);
    expect(peekMessageBackup(make(big)).userId).toBe(2 ** 40 + 5);
    expect(open(make(big), { userId: 2 ** 40 + 5 }).data).toEqual(sample);
  });
});
