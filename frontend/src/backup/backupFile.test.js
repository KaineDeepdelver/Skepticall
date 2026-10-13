/** @jest-environment node */
import nacl from 'tweetnacl';
import { decodeUTF8 } from 'tweetnacl-util';
import {
  BackupError,
  BackupErrorCode,
  DEFAULT_KDF,
  createBackup,
  peekBackup,
  restoreBackup,
} from './backupFile';

// Tiny Argon2 cost so the suite is fast. Production uses DEFAULT_KDF.
const FAST = { t: 1, m: 64 };
const PASS = 'correct horse battery staple';

/** An account with a key ring, newest key first (like the app keeps it). */
function account(userId, keyCount = 1) {
  return { userId, ring: Array.from({ length: keyCount }, () => nacl.box.keyPair()) };
}

const secretsOf = (acc) => acc.ring.map((p) => p.secretKey);
const publicsOf = (acc) => acc.ring.map((p) => p.publicKey);
const hex = (u8) => Buffer.from(u8).toString('hex');

const alice = account(12);
const sampleData = {
  conversations: [
    { with: 34, messages: [{ id: 1, text: 'hello world', at: '2026-10-10T10:00:00Z' }] },
  ],
  settings: { theme: 'dark' },
};

function backupOf(acc = alice, data = sampleData, passphrase = PASS) {
  return createBackup({ userId: acc.userId, secretKeys: secretsOf(acc), data, passphrase, kdf: FAST });
}

/** `validPublicKeys` is what GET /users/me/public-keys would return (current first). */
function restoreAs(bytes, acc = alice, { passphrase = PASS, validPublicKeys = publicsOf(acc) } = {}) {
  return restoreBackup(bytes, {
    passphrase,
    expectedUserId: acc.userId,
    expectedPublicKeys: validPublicKeys,
  });
}

function codeOf(fn) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(BackupError);
    return e.code;
  }
  throw new Error('expected a BackupError but nothing was thrown');
}

describe('backup file', () => {
  test('round trip returns the data and the account key', () => {
    const result = restoreAs(backupOf());

    expect(result.data).toEqual(sampleData);
    expect(result.userId).toBe(12);
    expect(result.secretKeys.map(hex)).toEqual(secretsOf(alice).map(hex));
    expect(result.currentKeyRestored).toBe(true);
    expect(typeof result.createdAt).toBe('string');
  });

  test('the file is encrypted: no readable content', () => {
    const asText = Buffer.from(backupOf()).toString('latin1');

    expect(asText).not.toContain('hello world');
    expect(asText).not.toContain('conversations');
  });

  test('the file is compressed', () => {
    const big = { messages: Array.from({ length: 2000 }, (_, i) => ({ id: i, text: 'hello world, same text again' })) };
    const raw = decodeUTF8(JSON.stringify(big)).length;

    expect(backupOf(alice, big).length).toBeLessThan(raw * 0.2);
  });

  test('two backups of the same data differ (fresh salt and nonce)', () => {
    expect(Buffer.from(backupOf()).equals(Buffer.from(backupOf()))).toBe(false);
  });

  // == Account binding =========================================================

  test('another account cannot use the file, even with the right passphrase', () => {
    const bob = account(99);

    expect(codeOf(() => restoreAs(backupOf(), bob))).toBe(BackupErrorCode.WRONG_ACCOUNT);
  });

  test('same user id but unrelated keys is rejected', () => {
    const impostor = account(12); // same id, different key pair

    expect(codeOf(() => restoreAs(backupOf(), impostor))).toBe(BackupErrorCode.KEYS_NO_LONGER_VALID);
  });

  test('editing the header (user id) breaks decryption instead of being trusted', () => {
    const bytes = backupOf();
    bytes[59] ^= 0x01; // flip a bit of the user id, 12 -> 13

    expect(codeOf(() => restoreAs(bytes, account(13)))).toBe(BackupErrorCode.WRONG_PASSPHRASE_OR_CORRUPT);
  });

  // == Rerolled keys (old keys stay valid for 30 days) =========================

  describe('after the account rerolled its key', () => {
    // Alice had `oldPair`, then rerolled to `newPair`.
    const oldPair = nacl.box.keyPair();
    const newPair = nacl.box.keyPair();
    const bothValid = [newPair.publicKey, oldPair.publicKey]; // server: current + retired (<30 days)
    const onlyNewValid = [newPair.publicKey]; // server: the old key passed its 30 days

    const backupWith = (pairs) =>
      createBackup({
        userId: 12,
        secretKeys: pairs.map((p) => p.secretKey),
        data: sampleData,
        passphrase: PASS,
        kdf: FAST,
      });
    const restoreWith = (bytes, validPublicKeys) =>
      restoreBackup(bytes, { passphrase: PASS, expectedUserId: 12, expectedPublicKeys: validPublicKeys });

    test('a backup made before the reroll still restores while the old key is valid', () => {
      const result = restoreWith(backupWith([oldPair]), bothValid);

      expect(result.secretKeys.map(hex)).toEqual([hex(oldPair.secretKey)]);
      expect(result.currentKeyRestored).toBe(false); // only a retired key came back: reroll again
    });

    test('...but not once the old key has passed its 30 days', () => {
      expect(codeOf(() => restoreWith(backupWith([oldPair]), onlyNewValid))).toBe(
        BackupErrorCode.KEYS_NO_LONGER_VALID
      );
    });

    test('a backup holding both keys restores both while the old one is valid', () => {
      const result = restoreWith(backupWith([newPair, oldPair]), bothValid);

      expect(result.secretKeys.map(hex)).toEqual([hex(newPair.secretKey), hex(oldPair.secretKey)]);
      expect(result.currentKeyRestored).toBe(true);
    });

    test('expired keys are dropped (and wiped) when the rest still restores', () => {
      const result = restoreWith(backupWith([newPair, oldPair]), onlyNewValid);

      expect(result.secretKeys.map(hex)).toEqual([hex(newPair.secretKey)]);
      expect(result.currentKeyRestored).toBe(true);
    });

    test("another account's valid keys never match", () => {
      const bobsKey = nacl.box.keyPair();

      expect(codeOf(() => restoreWith(backupWith([newPair, oldPair]), [bobsKey.publicKey]))).toBe(
        BackupErrorCode.KEYS_NO_LONGER_VALID
      );
    });
  });

  // == Passphrase, integrity, format ===========================================

  test('wrong passphrase is rejected', () => {
    expect(codeOf(() => restoreAs(backupOf(), alice, { passphrase: 'not the passphrase' }))).toBe(
      BackupErrorCode.WRONG_PASSPHRASE_OR_CORRUPT
    );
  });

  test('a flipped ciphertext bit is detected', () => {
    const bytes = backupOf();
    bytes[bytes.length - 5] ^= 0x01;

    expect(codeOf(() => restoreAs(bytes))).toBe(BackupErrorCode.WRONG_PASSPHRASE_OR_CORRUPT);
  });

  test('a truncated file is rejected', () => {
    const bytes = backupOf();

    expect(codeOf(() => restoreAs(bytes.slice(0, bytes.length - 10)))).toBe(
      BackupErrorCode.WRONG_PASSPHRASE_OR_CORRUPT
    );
    expect(codeOf(() => restoreAs(bytes.slice(0, 20)))).toBe(BackupErrorCode.BAD_FORMAT);
  });

  test('a file that is not a backup is rejected', () => {
    expect(codeOf(() => restoreAs(decodeUTF8('this is just some text file, nothing more to see here at all.')))).toBe(
      BackupErrorCode.BAD_FORMAT
    );
  });

  test('an unknown format version is rejected', () => {
    const bytes = backupOf();
    bytes[4] = 3;

    expect(codeOf(() => restoreAs(bytes))).toBe(BackupErrorCode.UNSUPPORTED_VERSION);
  });

  test('a crafted file cannot demand huge memory from the key derivation', () => {
    const bytes = backupOf();
    new DataView(bytes.buffer).setUint32(7, 4 * 1024 * 1024); // 4 GiB

    expect(codeOf(() => restoreAs(bytes))).toBe(BackupErrorCode.BAD_FORMAT);
  });

  test('short passphrases are refused when creating a backup', () => {
    expect(codeOf(() => backupOf(alice, sampleData, 'short'))).toBe(BackupErrorCode.WEAK_PASSPHRASE);
  });

  test('peekBackup shows the owner without a passphrase', () => {
    expect(peekBackup(backupOf())).toEqual({ version: 2, userId: 12, kdf: FAST });
  });

  test('large user ids survive the header encoding', () => {
    const big = account(2 ** 40 + 7);

    expect(peekBackup(backupOf(big)).userId).toBe(2 ** 40 + 7);
    expect(restoreAs(backupOf(big), big).userId).toBe(2 ** 40 + 7);
  });

  test('backups use the default Argon2id cost unless told otherwise', () => {
    const bytes = createBackup({
      userId: 12,
      secretKeys: secretsOf(alice),
      data: { ok: true },
      passphrase: PASS,
    });

    expect(DEFAULT_KDF).toEqual({ t: 2, m: 19456 });
    expect(peekBackup(bytes).kdf).toEqual(DEFAULT_KDF);
  }, 60000);
});
