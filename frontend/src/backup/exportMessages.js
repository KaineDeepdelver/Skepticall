/**
 * Collects everything a message backup holds: every conversation the account is in, the
 * messages decrypted to readable text, and (optionally) the photos, videos and files.
 *
 * Why readable text and not the original ciphertext: an old message can only be opened with the
 * sender's and recipient's keys from the moment it was sent, and those stop being available
 * after a key reroll (30 days). Decrypting now and sealing the result to the account key means
 * the backup never depends on old keys again. The file is still unreadable without the key:
 * see messageBackup.js.
 */

export const DEFAULT_MAX_FILE_BYTES = 100 * 1024 * 1024; // total attachment bytes in one backup

// Fields that only matter for decryption or that point at the server's (temporary) storage.
const STRIP = new Set([
  'nonce', 'replyPreviewNonce', 'mediaNonce', 'mediaKeyCiphertext', 'mediaKeyNonce',
  'wrappedKey', 'wrappedKeyNonce', 'keys', 'fileUrl', '_enc', '_undecryptable',
]);

export function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function defaultFetchFile(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: blob.type || '' };
}

function fileNameOf(msg) {
  if (msg.fileName) return String(msg.fileName);
  try {
    const last = String(msg.fileUrl || '').split('?')[0].split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : 'file';
  } catch {
    return 'file';
  }
}

function clean(msg) {
  const out = {};
  for (const [k, v] of Object.entries(msg)) if (!STRIP.has(k) && v !== undefined) out[k] = v;
  if (msg._undecryptable) {
    out.undecryptable = true;
    out.content = null;
    out.replyPreview = null;
  } else if (out.replyPreview === '🔒') {
    out.replyPreview = null;
  }
  return out;
}

/**
 * @param {object}   args
 * @param {object}   args.api         the app's `api` (getConversations, getHistory)
 * @param {object}   args.groupApi    the app's `groupApi` (getForUser, getMessages)
 * @param {object}   args.service     the E2EE service (decryptMessages, mediaUrl)
 * @param {{id:number, username?:string}} args.user
 * @param {boolean} [args.includeFiles=true]
 * @param {number}  [args.maxFileBytes]  total cap; files past it are listed but not stored
 * @param {(p:{stage:string, done:number, total:number})=>void} [args.onProgress]
 * @param {(url:string)=>Promise<{bytes:Uint8Array, mime:string}>} [args.fetchFile]
 * @returns {Promise<{data:object, stats:object}>}
 */
export async function collectMessages({
  api, groupApi, service, user,
  includeFiles = true,
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
  onProgress = () => {},
  fetchFile = defaultFetchFile,
}) {
  const [dms, groups] = await Promise.all([
    api.getConversations(user.id).catch(() => []),
    groupApi.getForUser(user.id).catch(() => []),
  ]);

  const stats = { conversations: 0, messages: 0, undecryptable: 0, files: 0, filesSkipped: 0, fileBytes: 0 };
  const conversations = [];
  const jobs = [
    ...dms.map((c) => ({ kind: 'direct', meta: c })),
    ...groups.map((g) => ({ kind: 'group', meta: g })),
  ];

  for (let i = 0; i < jobs.length; i++) {
    const { kind, meta } = jobs[i];
    onProgress({ stage: 'messages', done: i, total: jobs.length });

    let raw;
    try {
      raw = kind === 'group' ? await groupApi.getMessages(meta.id) : await api.getHistory(user.id, meta.userId);
    } catch {
      continue; // one conversation failing must not sink the whole backup
    }
    if (!raw || !raw.length) continue;
    const decrypted = await service.decryptMessages(raw);

    const messages = [];
    for (const msg of decrypted) {
      const out = clean(msg);
      stats.messages += 1;
      if (msg._undecryptable) stats.undecryptable += 1;

      if (msg.fileUrl && !msg._undecryptable) {
        if (!includeFiles) {
          out.file = { name: fileNameOf(msg), skipped: 'not-included' };
        } else {
          try {
            const url = await service.mediaUrl(msg);
            const { bytes, mime } = await fetchFile(url);
            if (stats.fileBytes + bytes.length > maxFileBytes) {
              out.file = { name: fileNameOf(msg), mime, size: bytes.length, skipped: 'too-large' };
              stats.filesSkipped += 1;
            } else {
              out.file = { name: fileNameOf(msg), mime, size: bytes.length, data: bytesToBase64(bytes) };
              stats.fileBytes += bytes.length;
              stats.files += 1;
            }
          } catch {
            out.file = { name: fileNameOf(msg), skipped: 'unavailable' };
            stats.filesSkipped += 1;
          }
        }
      } else if (msg.fileUrl) {
        out.file = { name: fileNameOf(msg), skipped: 'unavailable' };
        stats.filesSkipped += 1;
      }
      messages.push(out);
    }

    stats.conversations += 1;
    conversations.push(
      kind === 'group'
        ? { kind, id: meta.id, name: meta.name, members: (meta.members || []).map((m) => ({ id: m.id ?? m.userId, name: m.displayName || m.username || m.name })), messages }
        : { kind, id: meta.userId, name: meta.name, username: meta.username, messages },
    );
  }
  onProgress({ stage: 'done', done: jobs.length, total: jobs.length });

  return {
    data: { app: 'skepticall', exportedAt: new Date().toISOString(), me: { id: user.id, username: user.username }, conversations },
    stats,
  };
}
