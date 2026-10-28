import React, { useState } from 'react';
import { useBlocks } from '../context/BlockContext';
import UserAvatar from '../components/UserAvatar';
import Spinner from '../components/Spinner';
import '../reports/reports.css';

/** Settings: the people you have blocked, each with an Unblock button. */
export default function BlockedUsersList() {
  const { blocked, unblock } = useBlocks();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  async function undo(id) {
    setBusyId(id); setError('');
    try { await unblock(id); } catch { setError('Could not unblock. Try again.'); }
    setBusyId(null);
  }

  if (!blocked.length) return <p className="bl-empty">You haven’t blocked anyone.</p>;
  return (
    <div className="bl-list">
      {blocked.map((b) => (
        <div className="bl-row" key={b.userId}>
          <UserAvatar src={b.profilePicture} name={b.displayName || b.username} size={36} />
          <div className="bl-who">
            <strong>{b.displayName || b.username}</strong>
            <span>@{b.username}</span>
          </div>
          <button className="e2e-btn" onClick={() => undo(b.userId)} disabled={busyId === b.userId}>
            {busyId === b.userId ? <><Spinner />Unblocking…</> : 'Unblock'}
          </button>
        </div>
      ))}
      {error && <p className="rp-error" role="alert">{error}</p>}
    </div>
  );
}
