import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { REPORT_REASONS } from '../reports/ReportDialog';
import RouteLoader from '../components/RouteLoader';
import Spinner from '../components/Spinner';
import '../reports/reports.css';

const TABS = [['OPEN', 'Open'], ['RESOLVED', 'Resolved'], ['DISMISSED', 'Dismissed']];
const reasonLabel = (v) => (REPORT_REASONS.find((r) => r.value === v) || { label: v }).label;
const errorText = (e) => { const raw = (e && e.message) || 'Something went wrong'; try { return JSON.parse(raw).message || raw; } catch { return raw; } };

/** Admin only: the queue of reports. Child-safety reports are listed first. */
export default function AdminReportsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('OPEN');
  const [reports, setReports] = useState(null);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setReports(null); setError('');
    try {
      const list = await adminApi.listReports(tab);
      setReports(tab === 'OPEN' ? [...list].sort((a, b) => (b.reason === 'CHILD_SAFETY') - (a.reason === 'CHILD_SAFETY')) : list);
    } catch (e) { setError(errorText(e)); setReports([]); }
  }, [tab]);
  useEffect(() => { if (user && user.admin) load(); }, [user, load]);

  if (!user) return null;
  if (!user.admin) return <Navigate to="/" replace />;

  async function close(report, status) {
    setBusy(report.id); setError('');
    try { await adminApi.resolveReport(report.id, status, notes[report.id]); await load(); } catch (e) { setError(errorText(e)); }
    setBusy(null);
  }

  async function deleteAccount(report) {
    const who = report.targetUsername || `user ${report.targetUserId}`;
    if (!window.confirm(`Permanently delete the account of ${who}? This cannot be undone.`)) return;
    setBusy(report.id); setError('');
    try {
      await adminApi.deleteUser(report.targetUserId);
      await adminApi.resolveReport(report.id, 'RESOLVED', notes[report.id] || 'Account deleted');
      await load();
    } catch (e) { setError(errorText(e)); }
    setBusy(null);
  }

  return (
    <div className="ar-page">
      <h1>Reports</h1>
      <p className="ar-meta">People can report accounts, messages and groups. Message text is only here if the reporter chose to send it, and it can’t be verified.</p>
      <div className="ar-tabs" role="tablist">
        {TABS.map(([value, label]) => (
          <button key={value} role="tab" aria-selected={tab === value} className={`seg-btn${tab === value ? ' active' : ''}`} style={{ flex: 'none', padding: '0 16px' }} onClick={() => setTab(value)}>{label}</button>
        ))}
      </div>
      {error && <p className="rp-error" role="alert">{error}</p>}
      {reports === null && <RouteLoader />}
      {reports && !reports.length && !error && <p className="bl-empty">Nothing here.</p>}
      {reports && reports.map((r) => (
        <article key={r.id} className={`ar-card${r.reason === 'CHILD_SAFETY' && r.status === 'OPEN' ? ' ar-card--urgent' : ''}`}>
          <div className="ar-head">
            <span className={`ar-reason${r.reason === 'CHILD_SAFETY' ? ' ar-reason--urgent' : ''}`}>{reasonLabel(r.reason)}</span>
            <span className="ar-meta">{r.targetType.replace('_', ' ').toLowerCase()} · {new Date(r.createdAt).toLocaleString()}</span>
          </div>
          <p className="ar-meta">
            About {r.targetUsername ? `@${r.targetUsername}` : (r.targetType === 'GROUP' ? `group #${r.targetId}` : 'unknown')} · reported by @{r.reporterUsername || r.reporterId}
          </p>
          {r.details && <p>{r.details}</p>}
          {r.evidence && <div className="ar-evidence">{r.evidence}<small>Sent by the reporter. We can’t verify it.</small></div>}
          {r.status !== 'OPEN' && <p className="ar-meta">{r.status.toLowerCase()}{r.resolutionNote ? `: ${r.resolutionNote}` : ''}</p>}
          {r.status === 'OPEN' && (
            <div className="ar-actions">
              <input placeholder="Note (optional)" value={notes[r.id] || ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} aria-label="Note" />
              <button className="e2e-btn" onClick={() => close(r, 'DISMISSED')} disabled={busy === r.id}>Dismiss</button>
              <button className="e2e-btn" onClick={() => close(r, 'RESOLVED')} disabled={busy === r.id}>{busy === r.id ? <><Spinner />Saving…</> : 'Mark resolved'}</button>
              {r.targetUserId && <button className="e2e-btn" style={{ color: 'var(--danger, #ef4444)' }} onClick={() => deleteAccount(r)} disabled={busy === r.id}>Delete account</button>}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
