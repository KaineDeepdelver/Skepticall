import React, { useEffect, useMemo, useState } from 'react';
import { decodeBase64 } from 'tweetnacl-util';
import Glyph from '../components/icons/Glyph';

const SKIP_TEXT = {
  'too-large': 'File not included (too large)',
  'not-included': 'File not included',
  unavailable: 'File no longer available',
};

function Attachment({ file, type }) {
  const url = useMemo(() => {
    if (!file || !file.data) return null;
    try {
      return URL.createObjectURL(new Blob([decodeBase64(file.data)], { type: file.mime || 'application/octet-stream' }));
    } catch {
      return null;
    }
  }, [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  if (!file) return null;
  if (!url) return <div className="mb-file mb-file--missing">{SKIP_TEXT[file.skipped] || 'File not available'}: {file.name}</div>;

  const mime = file.mime || '';
  if (mime.startsWith('image/')) return <img className="mb-media" src={url} alt={file.name} />;
  if (mime.startsWith('video/')) return <video className="mb-media" src={url} controls />;
  if (mime.startsWith('audio/') || type === 'VOICE') return <audio src={url} controls />;
  return (
    <a className="mb-file" href={url} download={file.name}>
      <svg viewBox="0 0 24 24" width="18" height="18"><Glyph n="file" /></svg>
      <span>{file.name}</span>
    </a>
  );
}

const when = (m) => {
  const t = m.sentAt || m.createdAt || m.timestamp;
  const d = t ? new Date(t) : null;
  return d && !isNaN(d) ? d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
};

/** Read-only view of an opened message backup. Nothing here touches the server. */
export default function BackupViewer({ backup, onClose }) {
  const { data, createdAt } = backup;
  const convos = data.conversations || [];
  const [active, setActive] = useState(0);
  const convo = convos[active];
  const meId = data.me && data.me.id;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="mb-overlay" role="dialog" aria-modal="true" aria-label="Message backup">
      <div className="mb-viewer">
        <header className="mb-head">
          <div>
            <strong>Message backup</strong>
            <span className="mb-sub">
              {convos.length} conversations · saved {createdAt ? new Date(createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''}
            </span>
          </div>
          <button className="hdr-btn" onClick={onClose} aria-label="Close backup"><svg viewBox="0 0 24 24"><Glyph n="close" /></svg></button>
        </header>
        <div className="mb-body">
          <nav className="mb-list" aria-label="Conversations">
            {convos.map((c, i) => (
              <button key={`${c.kind}-${c.id}`} className={`mb-conv${i === active ? ' active' : ''}`} onClick={() => setActive(i)}>
                <span className="mb-conv-name">{c.name || c.username || 'Conversation'}</span>
                <span className="mb-conv-count">{c.messages.length}</span>
              </button>
            ))}
            {!convos.length && <p className="mb-empty">This backup has no conversations.</p>}
          </nav>
          <div className="mb-thread">
            {convo && convo.messages.map((m, i) => {
              const mine = String(m.senderId) === String(meId);
              return (
                <div key={m.id ?? i} className={`mb-msg${mine ? ' mine' : ''}`}>
                  {convo.kind === 'group' && !mine && m.senderName && <span className="mb-from">{m.senderName}</span>}
                  {m.replyPreview && <div className="mb-reply">{m.replyPreview}</div>}
                  {m.undecryptable
                    ? <em className="mb-lock">Could not be decrypted when this backup was made</em>
                    : (m.content ? <div className="mb-text">{m.content}</div> : null)}
                  {m.file && <Attachment file={m.file} type={m.type} />}
                  <span className="mb-time">{when(m)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
