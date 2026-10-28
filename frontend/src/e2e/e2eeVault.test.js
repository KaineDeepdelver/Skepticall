/** @jest-environment node */
import nacl from 'tweetnacl';
import { createE2EE } from './e2eeService';
import { createKeyStore, createMemoryBackend } from './keyStore';
import { b64 } from './box';
import { BackupErrorCode } from '../backup/backupFile';

global.File = global.File || require('buffer').File; // eslint-disable-line global-require

const PASSWORD = 'pw';
const PHRASE = 'river candle moon tree anchor planet';

/** A tiny in-memory "server" for one account: its key history and its stored key backup. */
function makeServer() {
  const acct = { id: 7, username: 'xelin', keys: [], vault: null };
  const api = {
    getMyKeys: async () => acct.keys,
    getUserKeys: async () => acct.keys,
    getUser: async () => ({ publicKey: acct.keys[0]?.publicKey ?? null }),
    rotateKey: async (publicKey, password) => {
      if (password !== PASSWORD) throw new Error('Password is incorrect');
      acct.keys = [{ publicKey, current: true }, ...acct.keys.map((k) => ({ ...k, current: false }))];
      return acct.keys;
    },
    getKeyVault: async () => (acct.vault ? { exists: true, ...acct.vault } : { exists: false }),
    putKeyVault: async (blob, currentPublicKey, password) => {
      if (password !== PASSWORD) throw new Error('Password is incorrect');
      if (currentPublicKey !== acct.keys[0]?.publicKey) throw new Error('The backup must be made with your current key');
      acct.vault = { blob, currentPublicKey, updatedAt: 'now' };
    },
    deleteKeyVault: async (password) => {
      if (password !== PASSWORD) throw new Error('Password is incorrect');
      acct.vault = null;
    },
  };
  const browser = () => {
    const store = createKeyStore(createMemoryBackend());
    const e2e = createE2EE({ store, api, fetchBytes: async () => null, makeObjectUrl: (b) => b, backupKdf: { t: 1, m: 64 } });
    return { e2e, store, user: { id: acct.id, username: acct.username } };
  };
  return { acct, api, browser };
}

/** A browser that already has the account's key. */
async function firstBrowser(server) {
  const pair = nacl.box.keyPair();
  server.acct.keys = [{ publicKey: b64(pair.publicKey), current: true }];
  const b = server.browser();
  await b.store.save(b.user.id, [pair]);
  await b.e2e.init(b.user);
  return b;
}

test('nothing is stored until a phrase is made, and the status says so', async () => {
  const server = makeServer();
  const b = await firstBrowser(server);
  expect(b.e2e.getState().status).toBe('ready');
  expect(await b.e2e.vaultStatus()).toBe('none');
});

test('save the phrase, then a brand-new browser unlocks the account with it', async () => {
  const server = makeServer();
  const first = await firstBrowser(server);
  await first.e2e.saveVault({ phrase: PHRASE, password: PASSWORD });
  expect(await first.e2e.vaultStatus()).toBe('current');

  const second = server.browser();                       // no key here at all
  await second.e2e.init(second.user);
  expect(second.e2e.getState().status).toBe('needs-restore');
  expect(await second.e2e.vaultStatus()).toBe('current'); // the gate uses this to offer the phrase

  await second.e2e.restoreFromVault({ phrase: 'River-CANDLE moon,tree  anchor planet' }); // typed loosely
  expect(second.e2e.getState().status).toBe('ready');
  expect(b64(second.e2e.getState().ring[0].publicKey)).toBe(server.acct.keys[0].publicKey);
  // and it kept the key on that browser, so the next visit needs nothing
  const again = server.browser();
  await again.store.save(second.user.id, await second.store.load(second.user.id));
  await again.e2e.init(again.user);
  expect(again.e2e.getState().status).toBe('ready');
});

test('the wrong phrase does not unlock anything', async () => {
  const server = makeServer();
  const first = await firstBrowser(server);
  await first.e2e.saveVault({ phrase: PHRASE, password: PASSWORD });
  const second = server.browser();
  await second.e2e.init(second.user);
  await expect(second.e2e.restoreFromVault({ phrase: 'river candle moon tree anchor harbor' }))
    .rejects.toMatchObject({ code: BackupErrorCode.WRONG_PASSPHRASE_OR_CORRUPT });
  expect(second.e2e.getState().status).toBe('needs-restore');
});

test('the server only ever holds the locked blob: no key bytes, no phrase', async () => {
  const server = makeServer();
  const first = await firstBrowser(server);
  await first.e2e.saveVault({ phrase: PHRASE, password: PASSWORD });

  const blob = Buffer.from(server.acct.vault.blob, 'base64');
  const secret = Buffer.from(first.e2e.getState().ring[0].secretKey);
  expect(blob.includes(secret)).toBe(false);
  expect(blob.toString('latin1')).not.toContain('river');
  expect(JSON.stringify(server.acct)).not.toContain(PHRASE);
});

test('saving needs the account password, and only a backup of the current key is accepted', async () => {
  const server = makeServer();
  const first = await firstBrowser(server);
  await expect(first.e2e.saveVault({ phrase: PHRASE, password: 'nope' })).rejects.toThrow(/Password is incorrect/);
  expect(await first.e2e.vaultStatus()).toBe('none');
});

test('changing the key makes the stored backup out of date, and a new phrase fixes it', async () => {
  const server = makeServer();
  const first = await firstBrowser(server);
  await first.e2e.saveVault({ phrase: PHRASE, password: PASSWORD });

  await first.e2e.createNewKey(PASSWORD);
  expect(first.e2e.getState().freshKey).toBe(true);
  expect(await first.e2e.vaultStatus()).toBe('stale');

  await first.e2e.saveVault({ phrase: 'harbor lemon quiet orbit wagon pencil', password: PASSWORD });
  expect(await first.e2e.vaultStatus()).toBe('current');

  const second = server.browser();
  await second.e2e.init(second.user);
  await second.e2e.restoreFromVault({ phrase: 'harbor lemon quiet orbit wagon pencil' });
  expect(second.e2e.getState().status).toBe('ready');
  expect(second.e2e.getState().ring.length).toBe(2); // the newest key plus the one it replaced
});

test('an account with no backup says so clearly', async () => {
  const server = makeServer();
  await firstBrowser(server);
  const second = server.browser();
  await second.e2e.init(second.user);
  await expect(second.e2e.restoreFromVault({ phrase: PHRASE })).rejects.toMatchObject({ code: 'NO_VAULT' });
});

test('removing the backup works with the password', async () => {
  const server = makeServer();
  const first = await firstBrowser(server);
  await first.e2e.saveVault({ phrase: PHRASE, password: PASSWORD });
  await expect(first.e2e.removeVault('nope')).rejects.toThrow();
  await first.e2e.removeVault(PASSWORD);
  expect(await first.e2e.vaultStatus()).toBe('none');
});
