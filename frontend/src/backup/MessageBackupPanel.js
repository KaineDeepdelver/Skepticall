import React, { useRef, useState } from 'react';
import { useE2EE } from '../e2e/E2EEContext';
import { useAuth } from '../context/AuthContext';
import { api, groupApi } from '../services/api';
import { createMessageBackup } from './messageBackup';
import { downloadBackup, readBackupFile } from './backupIO';
import { collectMessages } from './exportMessages';
import { openMessageBackup, backupErrorText } from './openMessageBackup';
import BackupViewer from './BackupViewer';
import './messageBackup.css';

const fileName = (d = new Date()) => `skepticall-messages-${d.toISOString().slice(0, 10)}.dat`;

function formatBytes(n) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Settings control for the message backup.
 *
 * "Download messages" saves one .dat file: every conversation, decrypted, with photos, videos and
 * files, compressed and sealed to the account's key.
 * "Open backup" shows one. It only opens when all of these are true: the file was made by this
 * account, this browser holds the key it was sealed to, and that key is still valid on the server.
 */
export default function MessageBackupPanel() {
  const { service, status } = useE2EE();
  const { user } = useAuth();
  const [includeFiles, setIncludeFiles] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [opened, setOpened] = useState(null);
  const picker = useRef(null);

  if (status !== 'ready') return <span className="setting-desc">Not available</span>;

  async function download() {
    setBusy(true); setError(''); setDone(''); setProgress('Collecting your messages…');
    try {
      const { data, stats } = await collectMessages({
        api, groupApi, service, user, includeFiles,
        onProgress: ({ stage, done: d, total }) => {
          if (stage === 'messages') setProgress(`Collecting conversations… ${d + 1} of ${total}`);
        },
      });
      if (!stats.messages) { setError('There are no messages to back up yet.'); return; }
      setProgress('Compressing and locking the file…');
      await new Promise((r) => setTimeout(r, 30)); // let the progress text paint
      const keyPair = service.getState().ring[0];
      const bytes = createMessageBackup({ userId: Number(user.id), keyPair, data });
      downloadBackup(bytes, fileName());

      const bits = [`${stats.messages} messages`, `${stats.conversations} conversations`];
      if (stats.files) bits.push(`${stats.files} files (${formatBytes(stats.fileBytes)})`);
      let msg = `Saved ${bits.join(', ')}.`;
      if (stats.filesSkipped) msg += ` ${stats.filesSkipped} files could not be included (too large or no longer available).`;
      if (stats.undecryptable) msg += ` ${stats.undecryptable} messages could not be decrypted and are marked as such.`;
      setDone(msg);
    } catch (err) {
      setError(backupErrorText(err));
    } finally {
      setBusy(false); setProgress('');
    }
  }

  async function onPick(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setError(''); setDone(''); setProgress('Opening the backup…');
    try {
      const bytes = await readBackupFile(file);
      const res = await openMessageBackup(bytes, { service, api, userId: user.id });
      setOpened(res);
    } catch (err) {
      setError(backupErrorText(err));
    } finally {
      setBusy(false); setProgress('');
    }
  }

  return (
    <div className="mb-panel">
      <div className="mb-actions">
        <button className="e2e-btn e2e-btn--primary" onClick={download} disabled={busy}>
          {busy && progress ? 'Working…' : 'Download messages'}
        </button>
        <button className="e2e-btn" onClick={() => picker.current && picker.current.click()} disabled={busy}>
          Open backup
        </button>
        <input ref={picker} type="file" accept=".dat" onChange={onPick} hidden />
      </div>
      <label className="mb-check">
        <input type="checkbox" checked={includeFiles} onChange={(e) => setIncludeFiles(e.target.checked)} disabled={busy} />
        Include photos, videos and files
      </label>
      {progress && <span className="mb-note" role="status">{progress}</span>}
      {done && <span className="mb-note mb-note--ok" role="status">{done}</span>}
      {error && <span className="e2e-error" role="alert">{error}</span>}
      {opened && <BackupViewer backup={opened} onClose={() => setOpened(null)} />}
    </div>
  );
}
