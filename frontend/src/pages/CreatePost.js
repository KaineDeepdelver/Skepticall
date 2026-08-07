import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, API_BASE } from '../services/api';

/* ── Icons ─────────────────────────────────────────── */
const BoldIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>;
const ItalicIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>;
const StrikeIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><line x1="5" y1="12" x2="19" y2="12"/><path d="M16 6C16 6 14.5 4 12 4s-5 1.5-5 4c0 5 9 3 9 8 0 2.5-2 4-4 4s-5-1.5-5-4"/></svg>;
const LinkIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
const ListIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const OListIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>;
const CodeIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
const QuoteIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>;
const TableIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/></svg>;
const ImagePickIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const UploadIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>;
const ChevronDown   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>;
const CloseIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const PlusIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const SuperIcon     = () => <span style={{fontSize:12,fontWeight:700,lineHeight:1}}>X²</span>;
const SubIcon       = () => <span style={{fontSize:12,fontWeight:700,lineHeight:1}}>X₂</span>;
const HeadingIcon   = () => <span style={{fontSize:12,fontWeight:700,lineHeight:1,fontFamily:'serif'}}>T↕</span>;

const TABS = ['Text', 'Images & Video', 'Link', 'Poll'];

const TOOLBAR = [
  { label: 'Bold',        icon: <BoldIcon /> },
  { label: 'Italic',      icon: <ItalicIcon /> },
  { label: 'Strikethrough', icon: <StrikeIcon /> },
  { label: 'Superscript', icon: <SuperIcon /> },
  { label: 'Heading',     icon: <HeadingIcon /> },
  null,
  { label: 'Link',        icon: <LinkIcon /> },
  { label: 'Image',       icon: <ImagePickIcon /> },
  { label: 'Emoji',       icon: <span style={{fontSize:13}}>☺</span> },
  null,
  { label: 'Bullet list', icon: <ListIcon /> },
  { label: 'Numbered list', icon: <OListIcon /> },
  null,
  { label: 'Quote',       icon: <QuoteIcon /> },
  { label: 'Code',        icon: <CodeIcon /> },
  { label: 'Code block',  icon: <span style={{fontSize:11,fontFamily:'monospace',fontWeight:700}}>{`</>`}</span> },
  { label: 'Spoiler',     icon: <span style={{fontSize:11,fontWeight:700}}>◈</span> },
  { label: 'Table',       icon: <TableIcon /> },
];

function Avatar({ src, name, size = 32 }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const base = { width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'block' };
  if (src) {
    const url = src.startsWith('http') ? src : `${API_BASE}${src}`;
    return <img src={url} alt={name} style={{ ...base, objectFit: 'cover', border: '2px solid var(--border-input)' }} />;
  }
  return <div style={{ ...base, background: 'linear-gradient(135deg,#4facfe,#00c6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', border: '2px solid var(--border-input)' }}>{initials}</div>;
}

function Toolbar({ onAction, tab }) {
  const textareaTools = tab === 'Text' || tab === 'Link' || tab === 'Poll';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 1,
      padding: '6px 10px', flexWrap: 'wrap',
      borderBottom: '1px solid var(--border)',
    }}>
      {TOOLBAR.map((btn, i) =>
        btn === null ? (
          <div key={i} style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />
        ) : (
          <button key={i} title={btn.label}
            onClick={() => onAction?.(btn.label)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: '4px 6px', borderRadius: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}>
            {btn.icon}
          </button>
        )
      )}
      <div style={{ marginLeft: 'auto' }}>
        <button style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
          padding: '4px 8px', borderRadius: 5, whiteSpace: 'nowrap',
          transition: 'color 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
          Switch to Markdown
        </button>
      </div>
    </div>
  );
}

/* ── Tab panels ─────────────────────────────────────── */

function TextPanel({ content, setContent, bodyRef }) {
  return (
    <div style={{
      border: '1px solid var(--border-input)', borderRadius: 12,
      background: 'var(--bg-input)', overflow: 'hidden',
    }}>
      <Toolbar tab="Text" />
      <textarea
        ref={bodyRef}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Body text (optional)"
        rows={6}
        style={{
          width: '100%', background: 'transparent', border: 'none', outline: 'none',
          color: 'var(--text-primary)', fontSize: 14, resize: 'vertical',
          fontFamily: 'inherit', lineHeight: 1.6, padding: '12px 14px',
          minHeight: 120, boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function ImagesVideoPanel({ attachments, setAttachments }) {
  const fileRef = useRef();

  function pickFiles(e) {
    const files = Array.from(e.target.files || []); if (!files.length) return; e.target.value = '';
    const reads = files.map(file => new Promise(resolve => {
      const mime = file.type;
      let kind = null;
      if (mime.startsWith('image/gif')) kind = 'GIF';
      else if (mime.startsWith('image/')) kind = 'IMAGE';
      else if (mime.startsWith('video/')) kind = 'VIDEO';
      if (!kind) return resolve(null);
      const reader = new FileReader();
      reader.onload = ev => resolve({ file, dataUrl: ev.target.result, kind });
      reader.readAsDataURL(file);
    }));
    Promise.all(reads).then(results => setAttachments(prev => [...prev, ...results.filter(Boolean)]));
  }

  return (
    <div>
      <input ref={fileRef} type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} onChange={pickFiles} />
      {attachments.length === 0 ? (
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            width: '100%', minHeight: 160,
            border: '2px dashed var(--border-input)', borderRadius: 12,
            background: 'var(--bg-input)', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, color: 'var(--text-muted)', transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.background = 'var(--bg-input)'; }}>
          <UploadIcon />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Drag and Drop or upload media</span>
        </button>
      ) : (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: attachments.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 8, marginBottom: 10,
          }}>
            {attachments.map((att, idx) => (
              <div key={idx} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-hover)', aspectRatio: attachments.length === 1 ? '16/9' : '1' }}>
                {att.kind === 'VIDEO'
                  ? <video src={att.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} muted />
                  : <img src={att.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff',
                    borderRadius: '50%', width: 22, height: 22, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <CloseIcon />
                </button>
                <span style={{
                  position: 'absolute', bottom: 6, left: 6,
                  background: 'rgba(0,0,0,0.6)', color: '#fff',
                  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                }}>{att.kind}</span>
              </div>
            ))}
            <button onClick={() => fileRef.current?.click()}
              style={{
                aspectRatio: '1', borderRadius: 10, border: '2px dashed var(--border-input)',
                background: 'var(--bg-input)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', minHeight: 80, transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-input)'}>
              <PlusIcon />
            </button>
          </div>
          <div style={{
            border: '1px solid var(--border-input)', borderRadius: 12,
            background: 'var(--bg-input)', overflow: 'hidden',
          }}>
            <Toolbar tab="Images & Video" />
            <div style={{ padding: '10px 14px', fontSize: 14, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Body text (optional)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LinkPanel({ linkUrl, setLinkUrl, content, setContent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input
        value={linkUrl}
        onChange={e => setLinkUrl(e.target.value)}
        placeholder="Link URL *"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'var(--bg-input)', border: '1px solid var(--border-input)',
          borderRadius: 12, padding: '13px 16px',
          color: 'var(--text-primary)', fontSize: 14, outline: 'none',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border-input)'}
      />
      <div style={{ border: '1px solid var(--border-input)', borderRadius: 12, background: 'var(--bg-input)', overflow: 'hidden' }}>
        <Toolbar tab="Link" />
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Body text (optional)"
          rows={5}
          style={{
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: 14, resize: 'vertical',
            fontFamily: 'inherit', lineHeight: 1.6, padding: '12px 14px',
            minHeight: 100, boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
}

function PollPanel({ pollOptions, setPollOptions, content, setContent }) {
  function addOption() {
    if (pollOptions.length >= 6) return;
    setPollOptions(prev => [...prev, '']);
  }
  function updateOption(idx, val) {
    setPollOptions(prev => prev.map((o, i) => i === idx ? val : o));
  }
  function removeOption(idx) {
    if (pollOptions.length <= 2) return;
    setPollOptions(prev => prev.filter((_, i) => i !== idx));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {pollOptions.map((opt, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={opt}
            onChange={e => updateOption(idx, e.target.value)}
            placeholder={`Option ${idx + 1}`}
            maxLength={60}
            style={{
              flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-input)',
              borderRadius: 12, padding: '11px 14px',
              color: 'var(--text-primary)', fontSize: 14, outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-input)'}
          />
          {pollOptions.length > 2 && (
            <button onClick={() => removeOption(idx)} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
              padding: 6, borderRadius: '50%', display: 'flex', alignItems: 'center',
            }}>
              <CloseIcon />
            </button>
          )}
        </div>
      ))}
      {pollOptions.length < 6 && (
        <button onClick={addOption} style={{
          background: 'none', border: '1px dashed var(--border-input)', borderRadius: 12,
          padding: '10px 14px', color: 'var(--text-muted)', cursor: 'pointer',
          fontSize: 13, textAlign: 'left', transition: 'border-color 0.15s, color 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
          + Add option
        </button>
      )}
      <div style={{ border: '1px solid var(--border-input)', borderRadius: 12, background: 'var(--bg-input)', overflow: 'hidden' }}>
        <Toolbar tab="Poll" />
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Body text*"
          rows={4}
          style={{
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: 14, resize: 'vertical',
            fontFamily: 'inherit', lineHeight: 1.6, padding: '12px 14px',
            minHeight: 90, boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
}

/* ── Main CreatePost page ───────────────────────────── */
export default function CreatePost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialTab = (() => {
    const t = searchParams.get('tab');
    if (t === 'images') return 'Images & Video';
    if (t === 'link')   return 'Link';
    return 'Text';
  })();

  const [activeTab,    setActiveTab]    = useState(initialTab);
  const [title,        setTitle]        = useState('');
  const [content,      setContent]      = useState('');
  const [linkUrl,      setLinkUrl]      = useState('');
  const [attachments,  setAttachments]  = useState([]);
  const [pollOptions,  setPollOptions]  = useState(['', '']);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');

  const titleCharLimit = 300;
  const bodyRef = useRef();

  const avatarSrc = user?.profilePicture
    ? (user.profilePicture.startsWith('http') ? user.profilePicture : `${API_BASE}${user.profilePicture}`)
    : null;

  const communityName = 'r/' + (user?.username || 'me');

  function canPost() {
    if (!title.trim()) return false;
    if (activeTab === 'Link' && !linkUrl.trim()) return false;
    return true;
  }

  async function handlePost() {
    if (!canPost()) return;
    setSubmitting(true); setError('');
    try {
      const fd = new FormData();
      fd.append('authorId', user.id);
      fd.append('title', title.trim());

      let bodyText = content.trim();
      if (activeTab === 'Link' && linkUrl.trim()) {
        bodyText = (bodyText ? bodyText + '\n\n' : '') + linkUrl.trim();
      }
      if (activeTab === 'Poll') {
        const opts = pollOptions.filter(o => o.trim());
        bodyText = (bodyText ? bodyText + '\n\n' : '') + '[Poll]\n' + opts.map((o, i) => `${i + 1}. ${o}`).join('\n');
      }
      if (bodyText) fd.append('content', bodyText);
      attachments.forEach(att => fd.append('media', att.file));

      await api.createPost(fd);
      navigate('/');
    } catch { setError('Failed to post. Please try again.'); }
    finally { setSubmitting(false); }
  }

  async function handleSaveDraft() {
    // Draft saving UI placeholder — could be extended with localStorage or API
    navigate('/');
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Page header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px 0',
        maxWidth: 740, width: '100%', margin: '0 auto', boxSizing: 'border-box',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Create post
        </h1>
        <button
          onClick={() => navigate('/drafts')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
            padding: '6px 10px', borderRadius: 8, transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
          Drafts
        </button>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, maxWidth: 740, width: '100%',
        margin: '0 auto', padding: '16px 24px 100px',
        boxSizing: 'border-box',
      }}>

        {/* Community selector */}
        <button style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-card)', border: '1px solid var(--border-input)',
          borderRadius: 20, padding: '7px 14px', cursor: 'pointer',
          marginBottom: 20, transition: 'border-color 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-input)'}>
          <Avatar src={avatarSrc} name={user?.username} size={24} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{communityName}</span>
          <ChevronDown />
        </button>

        {/* Tab bar */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border)',
          marginBottom: 20, gap: 0,
        }}>
          {TABS.map(tab => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 18px',
                fontSize: 14, fontWeight: activeTab === tab ? 700 : 500,
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.15s',
              }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Title */}
        <div style={{ marginBottom: 12 }}>
          <div style={{
            border: '1px solid var(--border-input)', borderRadius: 12,
            background: 'var(--bg-input)', position: 'relative',
            transition: 'border-color 0.15s',
          }}>
            <input
              value={title}
              onChange={e => { if (e.target.value.length <= titleCharLimit) setTitle(e.target.value); }}
              placeholder="Title*"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: 15, fontWeight: 500,
                padding: '14px 16px 28px',
              }}
              onFocus={e => e.target.parentElement.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.parentElement.style.borderColor = 'var(--border-input)'}
            />
            <span style={{
              position: 'absolute', bottom: 8, right: 12,
              fontSize: 11, color: 'var(--text-muted)',
            }}>{title.length}/{titleCharLimit}</span>
          </div>
        </div>

        {/* Flair button */}
        <div style={{ marginBottom: 16 }}>
          <button style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-input)',
            borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
            transition: 'border-color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-input)'}>
            Add flair and tags
            <span style={{ color: '#e06060', fontSize: 11 }}>*</span>
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'Text'           && <TextPanel content={content} setContent={setContent} bodyRef={bodyRef} />}
        {activeTab === 'Images & Video' && <ImagesVideoPanel attachments={attachments} setAttachments={setAttachments} />}
        {activeTab === 'Link'           && <LinkPanel linkUrl={linkUrl} setLinkUrl={setLinkUrl} content={content} setContent={setContent} />}
        {activeTab === 'Poll'           && <PollPanel pollOptions={pollOptions} setPollOptions={setPollOptions} content={content} setContent={setContent} />}

        {error && (
          <p style={{ color: '#e06060', fontSize: 13, marginTop: 12 }}>{error}</p>
        )}
      </div>

      {/* Sticky footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'flex-end',
        gap: 10, padding: '12px 24px',
        zIndex: 100,
      }}>
        <button
          onClick={handleSaveDraft}
          style={{
            background: 'var(--bg-hover)', border: '1px solid var(--border-input)',
            color: 'var(--text-muted)', borderRadius: 20,
            padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
          Save Draft
        </button>
        <button
          onClick={handlePost}
          disabled={submitting || !canPost()}
          style={{
            background: canPost() ? 'var(--accent)' : 'var(--bg-hover)',
            border: '1px solid transparent',
            color: canPost() ? '#fff' : 'var(--text-muted)',
            borderRadius: 20, padding: '8px 24px',
            fontSize: 14, fontWeight: 600,
            cursor: canPost() ? 'pointer' : 'default',
            transition: 'all 0.15s',
            opacity: submitting ? 0.7 : 1,
          }}>
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  );
}