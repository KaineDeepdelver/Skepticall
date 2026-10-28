import React, { useEffect, useRef, useState } from 'react';
import { reportApi } from '../services/api';
import { useBlocks } from '../context/BlockContext';
import Spinner from '../components/Spinner';
import './reports.css';

export const REPORT_REASONS = [
  { value: 'SPAM',          label: 'Spam or a scam' },
  { value: 'HARASSMENT',    label: 'Harassment or bullying' },
  { value: 'HATE',          label: 'Hate or discrimination' },
  { value: 'SEXUAL_CONTENT', label: 'Sexual content' },
  { value: 'VIOLENCE',      label: 'Violence or threats' },
  { value: 'SELF_HARM',     label: 'Self-harm' },
  { value: 'CHILD_SAFETY',  label: 'Child safety' },
  { value: 'IMPERSONATION', label: 'Pretending to be someone else' },
  { value: 'ILLEGAL',       label: 'Something illegal' },
  { value: 'OTHER',         label: 'Something else' },
];

const TITLES = { USER: 'Report this person', MESSAGE: 'Report this message', GROUP: 'Report this group', GROUP_MESSAGE: 'Report this message' };

function errorText(e) {
  const raw = (e && e.message) || 'Something went wrong. Please try again.';
  try { const j = JSON.parse(raw); return j.message || raw; } catch { return raw; }
}

/**
 * Report a person, message, group or group message.
 *
 * target: { type, id, label, userId?, evidence? }
 *   label    who or what is being reported, shown in the dialog
 *   userId   the person behind it, so we can offer to block them afterwards
 *   evidence the text of a reported message. Messages are end-to-end encrypted, so we can only see what the
 *            person chooses to send; they choose here, and can untick it.
 */
export default function ReportDialog({ target, onClose }) {
  const { isBlocked, block } = useBlocks();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [includeText, setIncludeText] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [blockedNow, setBlockedNow] = useState(false);
  const first = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);
  useEffect(() => { if (first.current) first.current.focus(); }, [sent]);

  async function submit(e) {
    e.preventDefault();
    if (!reason) { setError('Choose what is wrong.'); return; }
    setBusy(true); setError('');
    try {
      await reportApi.submit({
        targetType: target.type,
        targetId: target.id,
        reason,
        details: details.trim() || undefined,
        evidence: target.evidence && includeText ? target.evidence : undefined,
      });
      setSent(true);
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  }

  async function blockThem() {
    setBusy(true);
    try { await block(target.userId); setBlockedNow(true); } catch (err) { setError(errorText(err)); }
    setBusy(false);
  }

  const canOfferBlock = sent && target.userId && !isBlocked(target.userId) && !blockedNow;

  return (
    <div className="rp-overlay" role="dialog" aria-modal="true" aria-labelledby="rp-title">
      <div className="rp-card">
        {!sent ? (
          <form onSubmit={submit}>
            <h2 id="rp-title">{TITLES[target.type] || 'Report'}</h2>
            {target.label && <p className="rp-sub">{target.label}</p>}
            <fieldset className="rp-reasons" disabled={busy}>
              <legend>What is wrong?</legend>
              {REPORT_REASONS.map((r, i) => (
                <label key={r.value} className={`rp-reason${reason === r.value ? ' is-on' : ''}`}>
                  <input type="radio" name="reason" value={r.value} checked={reason === r.value}
                    ref={i === 0 ? first : null} onChange={() => setReason(r.value)} />
                  {r.label}
                </label>
              ))}
            </fieldset>

            <label className="rp-field">More detail (optional)
              <textarea value={details} maxLength={1000} rows={3} disabled={busy}
                onChange={(e) => setDetails(e.target.value)} placeholder="Anything that helps us understand" />
            </label>

            {target.evidence && (
              <div className="rp-evidence">
                <label className="rp-check">
                  <input type="checkbox" checked={includeText} onChange={(e) => setIncludeText(e.target.checked)} disabled={busy} />
                  Send the text of this message with my report
                </label>
                {includeText && <blockquote>{target.evidence.length > 280 ? `${target.evidence.slice(0, 280)}…` : target.evidence}</blockquote>}
                <p className="rp-note">Messages are end-to-end encrypted, so we can’t read them. We only see what you choose to send.</p>
              </div>
            )}

            {error && <p className="rp-error" role="alert">{error}</p>}
            <div className="rp-actions">
              <button type="button" className="e2e-link" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="e2e-btn e2e-btn--primary" disabled={busy}>{busy ? <><Spinner />Sending…</> : 'Send report'}</button>
            </div>
          </form>
        ) : (
          <div>
            <h2 id="rp-title">Thanks, we got it</h2>
            <p>We review reports and can remove content or accounts that break the rules. The other person isn’t told who reported them.</p>
            {blockedNow && <p className="rp-ok">You blocked {target.label || 'them'}. They can no longer message or call you.</p>}
            {canOfferBlock && (
              <div className="rp-block">
                <p>Want to stop them contacting you?</p>
                <button className="e2e-btn" onClick={blockThem} disabled={busy}>{busy ? <><Spinner />Blocking…</> : `Block ${target.label || 'them'}`}</button>
              </div>
            )}
            {error && <p className="rp-error" role="alert">{error}</p>}
            <div className="rp-actions">
              <button className="e2e-btn e2e-btn--primary" onClick={onClose} ref={first}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
