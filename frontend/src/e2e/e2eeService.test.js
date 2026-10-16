/** @jest-environment node */
import nacl from 'tweetnacl';
import { createE2EE, EncryptionRequiredError, UNDECRYPTABLE_TEXT } from './e2eeService';
import { createKeyStore, createMemoryBackend } from './keyStore';
import { b64 } from './box';

// Jest's node environment doesn't expose Node's File; the browser (and this service) has it.
global.File = global.File || require('buffer').File; // eslint-disable-line global-require

/** A tiny in-memory "server": accounts, their key history, and uploaded files. */
function makeWorld() {
  const accounts = {}; // id -> { username, password, keys: [{ publicKey, current }] }
  const files = {};
  const apiFor = (id) => ({
    getMyKeys: async () => accounts[id].keys,
    getUserKeys: async (other) => {
      if (!accounts[other]) throw new Error('404');
      return accounts[other].keys;
    },
    getUser: async (other) => ({ publicKey: accounts[other]?.keys[0]?.publicKey ?? null }),
    rotateKey: async (publicKey, password) => {
      if (password !== accounts[id].password) throw new Error('Password is incorrect');
      accounts[id].keys = [{ publicKey, current: true }, ...accounts[id].keys.map((k) => ({ ...k, current: false }))];
      return accounts[id].keys;
    },
  });
  return {
    accounts, files,
    account(id, username, { keys = [] } = {}) {
      accounts[id] = { username, password: 'pw', keys: keys.map((k, i) => ({ publicKey: k, current: i === 0 })) };
    },
    /** What a browser for this account looks like. */
    client(id, { store = createKeyStore(createMemoryBackend()), fetchBytes } = {}) {
      const e2e = createE2EE({
        store,
        api: apiFor(id),
        fetchBytes: fetchBytes || (async (url) => files[url]),
        makeObjectUrl: (bytes, type) => ({ bytes, type }),
        backupKdf: { t: 1, m: 64 },
      });
      return { e2e, store, id, user: { id, username: accounts[id].username } };
    },
  };
}

/** A client that has set itself up (key made and registered). */
async function readyClient(world, id, username) {
  world.account(id, username);
  const c = world.client(id);
  await c.e2e.init(c.user);
  await c.e2e.createNewKey('pw');
  return c;
}

const stateOf = (c) => c.e2e.getState().status;
const asFile = (bytes, name) => new File([bytes], name);

describe('setting up keys', () => {
  test('an account without a key needs setup, and setting up registers one', async () => {
    const w = makeWorld();
    w.account(1, 'alice');
    const c = w.client(1);

    await c.e2e.init(c.user);
    expect(stateOf(c)).toBe('needs-setup');

    await c.e2e.createNewKey('pw');
    expect(stateOf(c)).toBe('ready');
    expect(w.accounts[1].keys).toHaveLength(1);
    expect(b64(c.e2e.getState().ring[0].publicKey)).toBe(w.accounts[1].keys[0].publicKey);
  });

  test('a wrong password does not set anything up', async () => {
    const w = makeWorld();
    w.account(1, 'alice');
    const c = w.client(1);
    await c.e2e.init(c.user);

    await expect(c.e2e.createNewKey('nope')).rejects.toThrow('Password is incorrect');

    expect(stateOf(c)).toBe('needs-setup');
    expect(w.accounts[1].keys).toHaveLength(0);
  });

  test('an account whose key is not on this browser needs a restore', async () => {
    const w = makeWorld();
    const alice = await readyClient(w, 1, 'alice');
    const otherBrowser = w.client(1);

    await otherBrowser.e2e.init(otherBrowser.user);

    expect(stateOf(otherBrowser)).toBe('needs-restore');
    expect(stateOf(alice)).toBe('ready');
  });

  test('a key made at sign-up is adopted at the first login', async () => {
    const w = makeWorld();
    const pair = nacl.box.keyPair();
    w.account(7, 'newbie', { keys: [b64(pair.publicKey)] });
    const c = w.client(7);
    await c.store.savePending('NewBie', [pair]); // sign-up stored it under the username

    await c.e2e.init(c.user);

    expect(stateOf(c)).toBe('ready');
    expect(await c.store.load(7)).not.toBeNull();
    expect(await c.store.takePending('newbie')).toBeNull(); // consumed
  });

  test('nothing is sent while this browser has no key (never plain text)', async () => {
    const w = makeWorld();
    w.account(1, 'alice');
    const c = w.client(1);
    await c.e2e.init(c.user);

    await expect(c.e2e.prepareText({ conv: { userId: 2 }, content: 'hi' })).rejects.toBeInstanceOf(EncryptionRequiredError);
    await expect(c.e2e.prepareUpload({ conv: { userId: 2 }, file: asFile(new Uint8Array(10), 'a.png') })).rejects.toBeInstanceOf(EncryptionRequiredError);
  });

  test('the same goes for a browser that needs its key restored', async () => {
    const w = makeWorld();
    await readyClient(w, 1, 'alice');
    const other = w.client(1);
    await other.e2e.init(other.user);

    await expect(other.e2e.prepareText({ conv: { userId: 2 }, content: 'hi' })).rejects.toMatchObject({ code: 'ENCRYPTION_REQUIRED' });
  });
});

describe('direct messages end to end', () => {
  let w; let alice; let bob;
  beforeEach(async () => {
    w = makeWorld();
    alice = await readyClient(w, 1, 'alice');
    bob = await readyClient(w, 2, 'bob');
  });

  const wire = (from, to, fields, extra = {}) => ({ id: 10, senderId: from, receiverId: to, type: 'TEXT', ...fields, ...extra });

  test('bob reads what alice sent, and alice reads her own copy', async () => {
    const { fields, encrypted } = await alice.e2e.prepareText({ conv: { userId: 2 }, content: 'hello bob', replyPreview: 'earlier' });
    const msg = wire(1, 2, fields);

    expect(encrypted).toBe(true);
    expect(msg.content).not.toBe('hello bob');
    expect(msg.nonce).toBeTruthy();
    expect((await bob.e2e.decryptMessage(msg)).content).toBe('hello bob');
    expect((await bob.e2e.decryptMessage(msg)).replyPreview).toBe('earlier');
    expect((await alice.e2e.decryptMessage(msg)).content).toBe('hello bob');
  });

  test('a third person cannot read it and gets a placeholder', async () => {
    const carol = await readyClient(w, 3, 'carol');
    const { fields } = await alice.e2e.prepareText({ conv: { userId: 2 }, content: 'private' });

    const out = await carol.e2e.decryptMessage(wire(1, 2, fields));

    expect(out.content).toBe(UNDECRYPTABLE_TEXT);
    expect(out._undecryptable).toBe(true);
  });

  test('plain messages pass through untouched', async () => {
    const msg = { id: 1, senderId: 1, receiverId: 2, content: 'old plain message', type: 'TEXT' };

    expect(await bob.e2e.decryptMessage(msg)).toBe(msg);
    expect(await bob.e2e.decryptMessage({ type: 'PRESENCE', userId: 1, online: true })).toEqual({ type: 'PRESENCE', userId: 1, online: true });
  });

  test('sending to someone with no key is refused, never sent as plain text', async () => {
    w.account(5, 'legacy'); // no key

    await expect(alice.e2e.prepareText({ conv: { userId: 5 }, content: 'hi' })).rejects.toThrow(/hasn’t turned on encryption/);
    await expect(alice.e2e.prepareUpload({ conv: { userId: 5 }, file: asFile(new Uint8Array(10), 'a.png') })).rejects.toBeInstanceOf(EncryptionRequiredError);
  });

  test('an edit is encrypted with a new nonce and decrypts on the other side', async () => {
    const { fields } = await alice.e2e.prepareText({ conv: { userId: 2 }, content: 'fixed typo' });

    const out = await bob.e2e.decryptMessage(wire(1, 2, fields, { type: 'EDIT', edited: true }));

    expect(out.content).toBe('fixed typo');
    expect(out.type).toBe('EDIT');
  });

  test('images round trip: the server only sees ciphertext', async () => {
    const original = Uint8Array.from({ length: 4000 }, (_, i) => (i * 13) % 256);
    const { file, fields, encrypted } = await alice.e2e.prepareUpload({
      conv: { userId: 2 }, file: asFile(original, 'photo.jpg'), content: 'look', replyPreview: undefined,
    });
    const uploaded = new Uint8Array(await file.arrayBuffer());
    w.files['https://files/photo.jpg'] = uploaded;
    const msg = wire(1, 2, fields, { type: 'IMAGE', fileUrl: 'https://files/photo.jpg' });

    expect(encrypted).toBe(true);
    expect(Buffer.from(uploaded).equals(Buffer.from(original))).toBe(false);
    expect(file.name).toBe('photo.jpg'); // the extension survives so the type can be guessed
    expect((await bob.e2e.decryptMessage(msg)).content).toBe('look');
    const shown = await bob.e2e.mediaUrl(msg);
    expect(shown.type).toBe('image/jpeg');
    expect(Buffer.from(shown.bytes).equals(Buffer.from(original))).toBe(true);
  });

  test('plain files are not downloaded or decrypted', async () => {
    const url = await bob.e2e.mediaUrl({ id: 1, fileUrl: '/files/a.png', type: 'IMAGE' });

    expect(url).toBe('/files/a.png');
  });

  test('files over the limit are refused instead of silently sent in the clear', async () => {
    const big = { name: 'big.bin', size: 65 * 1024 * 1024, arrayBuffer: async () => new ArrayBuffer(0) };

    await expect(alice.e2e.prepareUpload({ conv: { userId: 2 }, file: big })).rejects.toThrow(/over 64 MB/);
  });
});

describe('group messages end to end', () => {
  test('every member reads it; a non-member does not', async () => {
    const w = makeWorld();
    const [a, b, c] = [await readyClient(w, 1, 'a'), await readyClient(w, 2, 'b'), await readyClient(w, 3, 'c')];
    const outsider = await readyClient(w, 4, 'd');
    const conv = { isGroup: true, groupId: 9, members: [{ id: 1 }, { id: 2 }, { id: 3 }] };

    const { fields, encrypted } = await a.e2e.prepareText({ conv, content: 'team message', replyPreview: 'quoted' });
    const msg = { id: 5, groupId: 9, senderId: 1, type: 'TEXT', ...fields };

    expect(encrypted).toBe(true);
    for (const reader of [a, b, c]) {
      const out = await reader.e2e.decryptMessage(msg);
      expect(out.content).toBe('team message');
      expect(out.replyPreview).toBe('quoted');
    }
    expect((await outsider.e2e.decryptMessage(msg)).content).toBe(UNDECRYPTABLE_TEXT);
  });

  test('if any member has no key the message is refused (nothing goes out in plain text)', async () => {
    const w = makeWorld();
    const a = await readyClient(w, 1, 'a');
    w.account(2, 'old'); // no key
    const conv = { isGroup: true, members: [{ id: 1 }, { id: 2 }] };

    await expect(a.e2e.prepareText({ conv, content: 'hi' })).rejects.toThrow(/Someone in this group/);
    await expect(a.e2e.prepareUpload({ conv, file: asFile(new Uint8Array(10), 'a.png') })).rejects.toBeInstanceOf(EncryptionRequiredError);
  });

  test('group files round trip via the multipart fields', async () => {
    const w = makeWorld();
    const a = await readyClient(w, 1, 'a');
    const b = await readyClient(w, 2, 'b');
    const conv = { isGroup: true, members: [{ id: 1 }, { id: 2 }] };
    const original = Uint8Array.from({ length: 2500 }, (_, i) => (i * 3) % 256);

    const { file, fields } = await a.e2e.prepareUpload({ conv, file: asFile(original, 'v.webm'), content: 'caption' });
    w.files['/files/v.webm'] = new Uint8Array(await file.arrayBuffer());
    const recipientKeys = JSON.parse(fields.recipientKeysJson);
    const msg = { id: 8, groupId: 4, senderId: 1, type: 'VOICE', fileUrl: '/files/v.webm', content: fields.content, nonce: fields.nonce, mediaNonce: fields.mediaNonce, recipientKeys };

    expect(recipientKeys.map((k) => k.keyType).sort()).toEqual(['CONTENT', 'CONTENT', 'MEDIA', 'MEDIA']);
    expect((await b.e2e.decryptMessage(msg)).content).toBe('caption');
    const shown = await b.e2e.mediaUrl(msg);
    expect(shown.type).toBe('audio/webm');
    expect(Buffer.from(shown.bytes).equals(Buffer.from(original))).toBe(true);
  });
});

describe('rerolling the key', () => {
  test('a message encrypted to the old key still opens for 30 days', async () => {
    const w = makeWorld();
    const alice = await readyClient(w, 1, 'alice');
    const bob = await readyClient(w, 2, 'bob');
    // alice caches bob's current key, then bob rerolls
    const { fields } = await alice.e2e.prepareText({ conv: { userId: 2 }, content: 'sent with the old key' });
    await bob.e2e.createNewKey('pw');

    const out = await bob.e2e.decryptMessage({ id: 1, senderId: 1, receiverId: 2, ...fields });

    expect(out.content).toBe('sent with the old key');
    expect(bob.e2e.getState().ring).toHaveLength(2);
  });

  test('new messages use the new key', async () => {
    const w = makeWorld();
    const alice = await readyClient(w, 1, 'alice');
    const bob = await readyClient(w, 2, 'bob');
    await bob.e2e.createNewKey('pw');

    const { fields } = await alice.e2e.prepareText({ conv: { userId: 2 }, content: 'after the reroll' });
    const out = await bob.e2e.decryptMessage({ id: 1, senderId: 1, receiverId: 2, ...fields });

    expect(out.content).toBe('after the reroll');
  });

  test('a sender who rerolled later can still be read via their retired key', async () => {
    const w = makeWorld();
    const alice = await readyClient(w, 1, 'alice');
    const bob = await readyClient(w, 2, 'bob');
    const { fields } = await alice.e2e.prepareText({ conv: { userId: 2 }, content: 'from alice, old key' });
    await alice.e2e.createNewKey('pw');

    const out = await bob.e2e.decryptMessage({ id: 1, senderId: 1, receiverId: 2, ...fields });

    expect(out.content).toBe('from alice, old key');
  });

  test('after the 30 days the server drops the old key and it is wiped from this browser', async () => {
    const w = makeWorld();
    const alice = await readyClient(w, 1, 'alice');
    const bob = await readyClient(w, 2, 'bob');
    const { fields } = await alice.e2e.prepareText({ conv: { userId: 2 }, content: 'too old now' });
    await bob.e2e.createNewKey('pw');
    w.accounts[2].keys = w.accounts[2].keys.slice(0, 1); // grace period over: the server only lists the new key

    await bob.e2e.init(bob.user); // next login prunes
    const out = await bob.e2e.decryptMessage({ id: 1, senderId: 1, receiverId: 2, ...fields });

    expect(bob.e2e.getState().ring).toHaveLength(1);
    expect(await bob.store.load(2)).toHaveLength(1); // the expired private key is gone from storage too
    expect(out.content).toBe(UNDECRYPTABLE_TEXT);
  });

  test("an unreachable key list never wipes the browser's older keys", async () => {
    const w = makeWorld();
    const bob = await readyClient(w, 2, 'bob');
    await bob.e2e.createNewKey('pw');
    const api = { getMyKeys: async () => { throw new Error('offline'); }, getUserKeys: async () => [], getUser: async () => ({}), rotateKey: async () => [] };
    const again = createE2EE({ store: bob.store, api, makeObjectUrl: () => null });

    await again.init({ id: 2, username: 'bob', publicKey: w.accounts[2].keys[0].publicKey });

    expect(again.getState().status).toBe('ready');
    expect(again.getState().ring).toHaveLength(2);
  });
});

describe('restoring from a backup', () => {
  test('a new browser unlocks with the backup file and passphrase', async () => {
    const w = makeWorld();
    const alice = await readyClient(w, 1, 'alice');
    const backup = alice.e2e.exportKeyBackup('a long passphrase');
    const newBrowser = w.client(1);
    await newBrowser.e2e.init(newBrowser.user);
    expect(stateOf(newBrowser)).toBe('needs-restore');

    const result = await newBrowser.e2e.restoreFromBackup({ bytes: backup, passphrase: 'a long passphrase' });

    expect(result.currentKeyRestored).toBe(true);
    expect(stateOf(newBrowser)).toBe('ready');
    const { fields } = await alice.e2e.prepareText({ conv: { userId: 1 }, content: 'note to self' });
    expect((await newBrowser.e2e.decryptMessage({ id: 1, senderId: 1, receiverId: 1, ...fields })).content).toBe('note to self');
  });

  test('a wrong passphrase or another account\'s backup is refused', async () => {
    const w = makeWorld();
    const alice = await readyClient(w, 1, 'alice');
    const bob = await readyClient(w, 2, 'bob');
    const backup = alice.e2e.exportKeyBackup('a long passphrase');
    const bobsNewBrowser = w.client(2);
    await bobsNewBrowser.e2e.init(bobsNewBrowser.user);

    await expect(bobsNewBrowser.e2e.restoreFromBackup({ bytes: backup, passphrase: 'a long passphrase' })).rejects.toMatchObject({ code: 'WRONG_ACCOUNT' });
    const alicesNewBrowser = w.client(1);
    await alicesNewBrowser.e2e.init(alicesNewBrowser.user);
    await expect(alicesNewBrowser.e2e.restoreFromBackup({ bytes: backup, passphrase: 'wrong passphrase' })).rejects.toMatchObject({ code: 'WRONG_PASSPHRASE_OR_CORRUPT' });
    expect(stateOf(alicesNewBrowser)).toBe('needs-restore');
    expect(stateOf(bob)).toBe('ready');
  });

  test('a backup made before a reroll restores only the older key and asks for a new one', async () => {
    const w = makeWorld();
    const alice = await readyClient(w, 1, 'alice');
    const backup = alice.e2e.exportKeyBackup('a long passphrase');
    await alice.e2e.createNewKey('pw'); // rerolled after the backup
    const newBrowser = w.client(1);
    await newBrowser.e2e.init(newBrowser.user);

    const result = await newBrowser.e2e.restoreFromBackup({ bytes: backup, passphrase: 'a long passphrase' });

    expect(result.currentKeyRestored).toBe(false);
    expect(stateOf(newBrowser)).toBe('needs-restore');
    expect(newBrowser.e2e.getState().notice).toBe('old-keys-only');
    await newBrowser.e2e.createNewKey('pw');
    expect(stateOf(newBrowser)).toBe('ready');
    expect(newBrowser.e2e.getState().ring).toHaveLength(2);
  });
});
