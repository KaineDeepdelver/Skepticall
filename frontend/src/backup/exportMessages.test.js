import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { collectMessages, bytesToBase64 } from './exportMessages';
import { createMessageBackup } from './messageBackup';
import { openMessageBackup, backupErrorText } from './openMessageBackup';
import { BackupErrorCode } from './backupFile';

const ME = { id: 7, username: 'xelin' };

function fakeApp({ withFile = true } = {}) {
  const encrypted = (id, sender, text, extra = {}) => ({
    id, senderId: sender, receiverId: sender === 7 ? 2 : 7, type: 'TEXT',
    content: `CIPHER-${text}`, nonce: 'n', sentAt: '2026-10-01T10:00:00Z', _text: text, ...extra,
  });
  const history = [
    encrypted(1, 2, 'hello'),
    encrypted(2, 7, 'hi back', { replyPreview: 'CIPHER-hello', replyPreviewNonce: 'n2' }),
    encrypted(3, 2, 'lost', { _fail: true }),
    ...(withFile ? [{ id: 4, senderId: 2, receiverId: 7, type: 'IMAGE', fileUrl: '/files/pic.png', mediaNonce: 'm', mediaKeyCiphertext: 'k', sentAt: '2026-10-01T10:05:00Z' }] : []),
  ];
  return {
    api: {
      getConversations: async () => [{ userId: 2, name: 'Maya', username: 'maya' }],
      getHistory: async () => history,
      getMyKeys: async () => [],
    },
    groupApi: {
      getForUser: async () => [{ id: 9, name: 'Crew', members: [{ id: 7, username: 'xelin' }] }],
      getMessages: async () => [{ id: 10, groupId: 9, senderId: 2, type: 'TEXT', content: 'CIPHER-yo', nonce: 'n', _text: 'yo', sentAt: '2026-10-02T10:00:00Z' }],
    },
    service: {
      decryptMessages: async (list) => list.map((m) => (
        m._fail ? { ...m, content: 'Unable to decrypt', _undecryptable: true }
          : m.nonce ? { ...m, content: m._text, replyPreview: m.replyPreview ? 'hello' : undefined, _enc: true } : m)),
      mediaUrl: async () => 'blob:fake',
    },
  };
}
const PNG = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 250, 251, 252]);
const fetchFile = async () => ({ bytes: PNG, mime: 'image/png' });

describe('collectMessages', () => {
  test('stores readable messages, strips crypto fields, includes the file bytes', async () => {
    const { api, groupApi, service } = fakeApp();
    const { data, stats } = await collectMessages({ api, groupApi, service, user: ME, fetchFile });

    expect(stats).toMatchObject({ conversations: 2, messages: 5, undecryptable: 1, files: 1, filesSkipped: 0 });
    const dm = data.conversations.find((c) => c.kind === 'direct');
    expect(dm.messages.map((m) => m.content)).toEqual(['hello', 'hi back', null, undefined]);
    expect(dm.messages[2].undecryptable).toBe(true);

    const json = JSON.stringify(data);
    expect(json).not.toContain('CIPHER-');
    ['nonce', 'mediaNonce', 'mediaKeyCiphertext', 'fileUrl'].forEach((k) => expect(json).not.toContain(`"${k}"`));

    const file = dm.messages[3].file;
    expect(file).toMatchObject({ name: 'pic.png', mime: 'image/png', size: PNG.length });
    expect(Array.from(decodeBase64(file.data))).toEqual(Array.from(PNG));
  });

  test('can leave files out, and respects the size cap', async () => {
    const a = fakeApp();
    const none = await collectMessages({ ...a, user: ME, fetchFile, includeFiles: false });
    expect(none.stats.files).toBe(0);
    expect(none.data.conversations[0].messages[3].file.skipped).toBe('not-included');

    const b = fakeApp();
    const capped = await collectMessages({ ...b, user: ME, fetchFile, maxFileBytes: 4 });
    expect(capped.stats).toMatchObject({ files: 0, filesSkipped: 1 });
    expect(capped.data.conversations[0].messages[3].file.skipped).toBe('too-large');
  });

  test('a conversation that fails to load does not sink the backup', async () => {
    const a = fakeApp();
    a.api.getHistory = async () => { throw new Error('boom'); };
    const { data } = await collectMessages({ ...a, user: ME, fetchFile });
    expect(data.conversations.map((c) => c.kind)).toEqual(['group']);
  });

  test('bytesToBase64 handles large buffers', () => {
    const big = new Uint8Array(300000).map((_, i) => i % 251);
    expect(Array.from(decodeBase64(bytesToBase64(big)))).toEqual(Array.from(big));
  });
});

describe('the backup needs both the file and the key', () => {
  const keyPair = nacl.box.keyPair();
  const other = nacl.box.keyPair();
  const serviceWith = (ring) => ({ getState: () => ({ ring }) });
  const apiWith = (pubs) => ({ getMyKeys: async () => pubs.map((p) => ({ publicKey: encodeBase64(p) })) });

  async function makeFile() {
    const { api, groupApi, service } = fakeApp();
    const { data } = await collectMessages({ api, groupApi, service, user: ME, fetchFile });
    return createMessageBackup({ userId: ME.id, keyPair, data });
  }

  test('file + key on this device + key valid on the server: opens, messages and files intact', async () => {
    const bytes = await makeFile();
    const { data } = await openMessageBackup(bytes, { service: serviceWith([keyPair]), api: apiWith([keyPair.publicKey]), userId: ME.id });
    expect(data.conversations[0].messages[0].content).toBe('hello');
    expect(data.conversations[0].messages[3].file.mime).toBe('image/png');
  });

  test('file without the key: refused', async () => {
    const bytes = await makeFile();
    await expect(openMessageBackup(bytes, { service: serviceWith([other]), api: apiWith([keyPair.publicKey]), userId: ME.id }))
      .rejects.toMatchObject({ code: BackupErrorCode.KEY_NOT_ON_DEVICE });
    await expect(openMessageBackup(bytes, { service: serviceWith([]), api: apiWith([keyPair.publicKey]), userId: ME.id }))
      .rejects.toMatchObject({ code: BackupErrorCode.KEY_NOT_ON_DEVICE });
  });

  test('right key but a different account: refused', async () => {
    const bytes = await makeFile();
    await expect(openMessageBackup(bytes, { service: serviceWith([keyPair]), api: apiWith([keyPair.publicKey]), userId: 8 }))
      .rejects.toMatchObject({ code: BackupErrorCode.WRONG_ACCOUNT });
  });

  test('key replaced on the server since the backup: refused', async () => {
    const bytes = await makeFile();
    await expect(openMessageBackup(bytes, { service: serviceWith([keyPair]), api: apiWith([other.publicKey]), userId: ME.id }))
      .rejects.toMatchObject({ code: BackupErrorCode.KEYS_NO_LONGER_VALID });
  });

  test('a tampered file is refused, and the server being unreachable is reported', async () => {
    const bytes = await makeFile();
    const bad = bytes.slice(); bad[bad.length - 5] ^= 0xff;
    await expect(openMessageBackup(bad, { service: serviceWith([keyPair]), api: apiWith([keyPair.publicKey]), userId: ME.id })).rejects.toBeTruthy();
    await expect(openMessageBackup(bytes, { service: serviceWith([keyPair]), api: { getMyKeys: async () => { throw new Error('x'); } }, userId: ME.id }))
      .rejects.toMatchObject({ code: 'NETWORK' });
  });

  test('every failure has plain-language text', () => {
    Object.values(BackupErrorCode).forEach((code) => expect(backupErrorText({ code, message: 'fallback' })).toBeTruthy());
    expect(backupErrorText({ code: BackupErrorCode.KEY_NOT_ON_DEVICE })).toMatch(/Restore your key backup/);
  });
});
