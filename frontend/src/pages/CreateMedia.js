import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, API_BASE } from '../services/api';

/* ── Icons ─────────────────────────────────────────── */
const ChevronDown = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>;
const UploadIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="44" height="44"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>;
const ImageIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const VideoPlayIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" strokeWidth="0"/></svg>;
const BackIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20"><polyline points="15 18 9 12 15 6"/></svg>;

function Avatar({ src, name, size = 32 }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const base = { width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'block' };
  if (src) {
    const url = src.startsWith('http') ? src : `${API_BASE}${src}`;
    return <img src={url} alt={name} style={{ ...base, objectFit: 'cover', border: '2px solid var(--border-input)' }} />;
  }
  return (
    <div style={{ ...base, background: 'linear-gradient(135deg,#4facfe,#00c6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', border: '2px solid var(--border-input)' }}>
      {initials}
    </div>
  );
}

/* ── Upload progress bar ── */
function ProgressBar({ value }) {
  return (
    <div style={{
      width: '100%', height: 4, borderRadius: 2,
      background: 'var(--border-input)', overflow: 'hidden', marginTop: 8,
    }}>
      <div style={{
        height: '100%', borderRadius: 2,
        background: 'var(--accent)',
        width: `${value}%`,
        transition: 'width 0.3s ease',
      }} />
    </div>
  );
}

/* ── Main CreateMedia page ──────────────────────────── */
export default function CreateMedia() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title,          setTitle]          = useState('');
  const [description,    setDescription]    = useState('');
  const [videoFile,      setVideoFile]      = useState(null);
  const [videoPreview,   setVideoPreview]   = useState(null);
  const [thumbFile,      setThumbFile]      = useState(null);
  const [thumbPreview,   setThumbPreview]   = useState(null);
  const [tags,           setTags]           = useState([]);
  const [tagInput,       setTagInput]       = useState('');
  const [submitting,     setSubmitting]     = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error,          setError]          = useState('');

  const videoRef = useRef();
  const thumbRef = useRef();

  const TITLE_LIMIT = 200;

  const avatarSrc = user?.profilePicture
    ? (user.profilePicture.startsWith('http') ? user.profilePicture : `${API_BASE}${user.profilePicture}`)
    : null;

  /* ── File handlers ── */
  function pickVideo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  }

  function pickThumb(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setThumbFile(file);
    const r = new FileReader();
    r.onload = ev => setThumbPreview(ev.target.result);
    r.readAsDataURL(file);
  }

  function addTag(e) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().replace(/,/g, '');
      if (!tags.includes(tag) && tags.length < 10) {
        setTags(prev => [...prev, tag]);
      }
      setTagInput('');
    }
  }

  function removeTag(tag) {
    setTags(prev => prev.filter(t => t !== tag));
  }

  function canUpload() {
    return title.trim() && videoFile;
  }

  async function handleUpload() {
    if (!canUpload()) return;
    setSubmitting(true);
    setError('');
    setUploadProgress(10);

    try {
      const fd = new FormData();
      fd.append('authorId', user.id);
      fd.append('title', title.trim());
      if (description.trim()) fd.append('description', description.trim());
      fd.append('video', videoFile);
      if (thumbFile) fd.append('thumbnail', thumbFile);
      if (tags.length) fd.append('tags', tags.join(','));

      setUploadProgress(40);
      await api.uploadMedia(fd);
      setUploadProgress(100);

      setTimeout(() => navigate('/media'), 500);
    } catch {
      setError('Upload failed. Please try again.');
      setUploadProgress(0);
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Styles ── */
  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg-input)', border: '1px solid var(--border-input)',
    borderRadius: 12, padding: '13px 16px',
    color: 'var(--text-primary)', fontSize: 14, outline: 'none',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px 0',
        maxWidth: 740, width: '100%', margin: '0 auto', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
              padding: 4, borderRadius: 8, transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            <BackIcon />
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Upload Media
          </h1>
        </div>
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

      {/* ── Body ── */}
      <div style={{
        flex: 1, maxWidth: 740, width: '100%',
        margin: '0 auto', padding: '16px 24px 100px',
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>

        {/* Channel selector */}
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-card)', border: '1px solid var(--border-input)',
            borderRadius: 20, padding: '7px 14px', cursor: 'pointer',
            transition: 'border-color 0.15s', width: 'fit-content',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-input)'}>
          <Avatar src={avatarSrc} name={user?.username} size={24} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            r/{user?.username || 'me'}
          </span>
          <ChevronDown />
        </button>

        {/* ── Video upload zone ── */}
        <input ref={videoRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={pickVideo} />
        <input ref={thumbRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickThumb} />

        {!videoFile ? (
          <button
            onClick={() => videoRef.current?.click()}
            style={{
              width: '100%', minHeight: 220,
              border: '2px dashed var(--border-input)', borderRadius: 16,
              background: 'var(--bg-input)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 12, color: 'var(--text-muted)', transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.background = 'var(--bg-input)'; }}>
            <UploadIcon />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Drag and drop or click to upload video
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                MP4, MOV, WebM, AVI — up to 500 MB
              </div>
            </div>
          </button>
        ) : (
          <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000' }}>
            <video
              src={videoPreview}
              style={{ width: '100%', maxHeight: 300, display: 'block', objectFit: 'contain' }}
              controls
            />
            <button
              onClick={() => videoRef.current?.click()}
              style={{
                position: 'absolute', bottom: 12, right: 12,
                background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', fontSize: 12, fontWeight: 600,
                padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                backdropFilter: 'blur(4px)', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.9)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}>
              Change video
            </button>
          </div>
        )}

        {/* ── Title + Thumbnail row ── */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {/* Thumbnail picker */}
          <button
            onClick={() => thumbRef.current?.click()}
            title="Set thumbnail"
            style={{
              width: 80, height: 80, flexShrink: 0,
              borderRadius: 12,
              border: '2px dashed var(--border-input)',
              background: 'var(--bg-input)',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', padding: 0,
              color: 'var(--text-muted)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-input)'}>
            {thumbPreview
              ? <img src={thumbPreview} alt="thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (
                <>
                  <ImageIcon />
                  <span style={{ fontSize: 10, marginTop: 4 }}>Thumbnail</span>
                </>
              )
            }
          </button>

          {/* Title */}
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              value={title}
              onChange={e => { if (e.target.value.length <= TITLE_LIMIT) setTitle(e.target.value); }}
              placeholder="Title *"
              style={{ ...inputStyle, paddingBottom: 28 }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-input)'}
            />
            <span style={{
              position: 'absolute', bottom: 9, right: 12,
              fontSize: 11, color: 'var(--text-muted)', pointerEvents: 'none',
            }}>
              {title.length}/{TITLE_LIMIT}
            </span>
          </div>
        </div>

        {/* ── Description ── */}
        <div style={{
          border: '1px solid var(--border-input)', borderRadius: 12,
          background: 'var(--bg-input)', overflow: 'hidden',
        }}>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={4}
            style={{
              width: '100%', background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 14, resize: 'vertical',
              fontFamily: 'inherit', lineHeight: 1.6, padding: '12px 14px',
              minHeight: 100, boxSizing: 'border-box',
            }}
          />
        </div>

        {/* ── Tags ── */}
        <div style={{
          background: 'var(--bg-input)', border: '1px solid var(--border-input)',
          borderRadius: 12, padding: '10px 12px',
          display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
          transition: 'border-color 0.15s',
        }}
          onFocusWithin={e => e.currentTarget.style.borderColor = 'var(--accent)'}
        >
          {tags.map(tag => (
            <span
              key={tag}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'var(--bg-hover)', border: '1px solid var(--border-input)',
                borderRadius: 20, padding: '3px 10px',
                fontSize: 13, color: 'var(--text-secondary)',
              }}>
              #{tag}
              <button
                onClick={() => removeTag(tag)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 14, lineHeight: 1,
                  padding: 0, display: 'flex', alignItems: 'center',
                }}>
                ×
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={addTag}
            placeholder={tags.length === 0 ? 'Add tags (press Enter)' : ''}
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 14,
              fontFamily: 'inherit', flex: 1, minWidth: 120,
            }}
          />
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -10 }}>
          Press Enter or comma to add a tag. Max 10 tags.
        </p>

        {/* Upload progress */}
        {submitting && <ProgressBar value={uploadProgress} />}

        {error && (
          <p style={{ color: '#e06060', fontSize: 13 }}>{error}</p>
        )}
      </div>

      {/* ── Sticky footer ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'flex-end',
        gap: 10, padding: '12px 24px',
        zIndex: 100,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'var(--bg-hover)', border: '1px solid var(--border-input)',
            color: 'var(--text-muted)', borderRadius: 20,
            padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={submitting || !canUpload()}
          style={{
            background: canUpload() ? 'var(--accent)' : 'var(--bg-hover)',
            border: '1px solid transparent',
            color: canUpload() ? '#fff' : 'var(--text-muted)',
            borderRadius: 20, padding: '8px 24px',
            fontSize: 14, fontWeight: 600,
            cursor: canUpload() ? 'pointer' : 'default',
            transition: 'all 0.15s',
            opacity: submitting ? 0.7 : 1,
          }}>
          {submitting ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </div>
  );
}