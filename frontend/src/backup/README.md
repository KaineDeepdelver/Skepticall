# Backup file (`.dat`)

`backupFile.js` creates and opens Skepticall backups. It is plain JavaScript with no DOM
dependency, so the same file works in the web app, React Native and Node.

```
data (JSON) ──gzip──▶ XSalsa20-Poly1305 ──▶ [60-byte header | ciphertext]
```

## What it guarantees

| Someone who... | Can they use the backup? |
|---|---|
| has the file, not the passphrase | No. It is authenticated ciphertext; Argon2id makes guessing slow. |
| has the file and passphrase, logged in as the **same** account | Yes. |
| has the file and passphrase, logged in as a **different** account | No (`WRONG_ACCOUNT`): the embedded keys must match public keys the server lists as valid for the logged-in account. |
| restores it after the account **rerolled its key** | Yes while the key in the backup is still valid (30 days after it was replaced); after that `KEYS_NO_LONGER_VALID`. |
| edits the header (user id, KDF settings) or the ciphertext | No. The header is mixed into the key (HKDF `info`), the ciphertext is authenticated. |

Other protections: fresh random salt and nonce per backup, KDF cost limits on restore (a crafted
file can't demand gigabytes), and an uncompressed-size limit (no zip bombs).

## Format

| Bytes | Field |
|---|---|
| 0-3 | magic `SKBK` |
| 4 | version (2) |
| 5 | KDF id (1 = Argon2id) |
| 6 | Argon2 iterations `t` (default 2) |
| 7-10 | Argon2 memory in KiB (default 19456) |
| 11 | parallelism (1) |
| 12-27 | salt |
| 28-51 | nonce |
| 52-59 | user id (a UI hint; re-checked after decryption) |
| 60- | ciphertext of `gzip(JSON)` |

The JSON holds `{ format, createdAt, userId, secretKeys, data }`. `secretKeys` is the account's key
ring: its X25519 private keys, current key first, including keys it rerolled away from that are
still inside the 30-day window. That is what lets a fresh device restore the identity and open
messages that were encrypted to an older key.

## Using it

```js
import { createBackup, restoreBackup, peekBackup, BackupErrorCode } from './backupFile';
import { downloadBackup, readBackupFile } from './backupIO';

// export: ring = the device's key ring, newest key first (see src/crypto/keyring.js)
const bytes = createBackup({
  userId,
  secretKeys: ring.map((pair) => pair.secretKey),
  data: { conversations },
  passphrase,
});
downloadBackup(bytes);

// import (logged in as the account being restored)
const bytes = await readBackupFile(file);
peekBackup(bytes).userId;                 // optional: show whose backup this is
const validKeys = await api.get('/users/me/public-keys');   // current first
const { data, secretKeys, currentKeyRestored } = restoreBackup(bytes, {
  passphrase,
  expectedUserId: me.id,
  expectedPublicKeys: validKeys.map((k) => decodeBase64(k.publicKey)),
});
if (!currentKeyRestored) {
  // The backup predates a reroll: this device only has retired keys. They still open old
  // messages, but reroll now so this device can receive new ones.
}
```

`restoreBackup` throws `BackupError` with `.code` in `BackupErrorCode`
(`WRONG_PASSPHRASE_OR_CORRUPT`, `WRONG_ACCOUNT`, `KEYS_NO_LONGER_VALID`, `BAD_FORMAT`, `UNSUPPORTED_VERSION`, `WEAK_PASSPHRASE`, `TOO_LARGE`).

## Limits to know about

- The passphrase is the only thing protecting a file that leaves the device. Use a long one
  (minimum is 8 characters; a few random words is better). A lost passphrase can't be recovered.
- A backup made before a reroll stops being restorable 30 days after the reroll (its keys are no longer valid). Make a fresh backup after rerolling.
- It backs up JSON data. Attachments (media files) aren't included.
- React Native needs a `crypto.getRandomValues` polyfill for `nacl.randomBytes`.
- Argon2 runs in JavaScript: roughly half a second on a laptop, slower on phones. It's a
  one-off action, so show a progress indicator.
