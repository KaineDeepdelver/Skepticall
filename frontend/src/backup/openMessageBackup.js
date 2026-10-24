import { decodeBase64 } from 'tweetnacl-util';
import { BackupErrorCode } from './backupFile';
import { restoreMessageBackup } from './messageBackup';

/**
 * Opens a message backup. All of these must hold, or it throws a BackupError:
 *   - the file was made by THIS account,
 *   - this browser holds the private key the file was sealed to,
 *   - that key is still one of the account's valid keys on the server.
 * File without key, or key without file, gets you nothing.
 */
export async function openMessageBackup(bytes, { service, api, userId }) {
  const { ring } = service.getState();
  let valid;
  try {
    valid = (await api.getMyKeys()).map((k) => decodeBase64(k.publicKey));
  } catch {
    const e = new Error('Could not reach the server to check your key. Try again.');
    e.code = 'NETWORK';
    throw e;
  }
  return restoreMessageBackup(bytes, { expectedUserId: Number(userId), ring, validPublicKeys: valid });
}

/** Plain-language text for every way opening a backup can fail. */
export function backupErrorText(err) {
  switch (err && err.code) {
    case BackupErrorCode.WRONG_ACCOUNT:
      return 'This backup was made by a different account. Log in to the account it belongs to.';
    case BackupErrorCode.KEY_NOT_ON_DEVICE:
      return 'This browser does not have the encryption key this backup was made with. Restore your key backup first, then open this file again.';
    case BackupErrorCode.KEYS_NO_LONGER_VALID:
      return 'The key this backup was made with has been replaced and is no longer valid for your account, so the file cannot be opened.';
    case BackupErrorCode.BAD_FORMAT:
      return 'This is not a Skepticall message backup.';
    case BackupErrorCode.UNSUPPORTED_VERSION:
      return 'This backup was made by a different version of the app.';
    case BackupErrorCode.TOO_LARGE:
      return 'This backup is too large to open here.';
    case BackupErrorCode.WRONG_PASSPHRASE_OR_CORRUPT:
      return 'The file is damaged, or it was not sealed to your key.';
    case 'NETWORK':
      return err.message;
    default:
      return (err && err.message) || 'Could not open this backup.';
  }
}
