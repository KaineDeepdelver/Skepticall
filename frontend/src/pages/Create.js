import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, API_BASE } from '../services/api';

/* ── Icons ──────────────────────────────────────────────────────────────── */
const IcText    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M4 6h16M4 12h10M4 18h14"/></svg>;
const IcImage   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const IcLink    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
const IcPoll    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IcBold    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>;
const IcItalic  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>;
const IcStrike  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><line x1="5" y1="12" x2="19" y2="12"/><path d="M16 6C16 6 14.5 4 12 4s-5 1.5-5 4c0 5 9 3 9 8 0 2.5-2 4-4 4s-5-1.5-5-4"/></svg>;
const IcLinkFmt = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
const IcQuote   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>;
const IcCode    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
const IcList    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const IcClose   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcPlus    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcUpload  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>;
const IcChevL   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>;
const IcChevR   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>;

const POST_TYPES = [
  { id: 'Text',   label: 'Text',   icon: IcText  },
  { id: 'Media',  label: 'Media',  icon: IcImage },
  { id: 'Link',   label: 'Link',   icon: IcLink  },
  { id: 'Poll',   label: 'Poll',   icon: IcPoll  },
];

/* ── WYSIWYG + Markdown Editor ─────────────────────────────────────────── */

// Converts basic markdown to HTML for WYSIWYG display
function mdToHtml(md) {
  if (!md) return '';
  let h = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // bold / italic / strike / code
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // blockquote
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    // bullet list
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // spoiler
    .replace(/&gt;!(.+?)!&lt;/g, '<span class="spoiler">$1</span>')
    // line breaks
    .replace(/\n/g, '<br/>');
  // wrap consecutive <li> in <ul>
  h = h.replace(/(<li>.*?<\/li>)(<br\/>)?/g, '$1').replace(/(<li>[\s\S]+?<\/li>)+/g, '<ul>$&</ul>');
  return h;
}

// Converts contenteditable HTML back to markdown for storage
function htmlToMd(html) {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    // strikethrough — browser uses <s>, <strike>, <del>, or span with style
    .replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~')
    .replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~')
    .replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
    .replace(/<span[^>]*text-decoration[^>]*line-through[^>]*>(.*?)<\/span>/gi, '~~$1~~')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => inner.split('\n').map(l => '> ' + l.replace(/<[^>]+>/g, '')).join('\n') + '\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1')
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1')
    .replace(/<a href="(.*?)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<span class="spoiler">(.*?)<\/span>/gi, '>!$1!<')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div>/gi, '\n').replace(/<\/div>/gi, '')
    .replace(/<p[^>]*>/gi, '').replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '') // strip any remaining tags
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n') // collapse excess newlines
    .trim();
}

const TOOLBAR_BTNS = [
  { label: 'Bold',     cmd: 'bold',            icon: <IcBold />,    md: ['**','**','bold text'] },
  { label: 'Italic',   cmd: 'italic',          icon: <IcItalic />,  md: ['*','*','italic text'] },
  { label: 'Strike',   cmd: 'strikeThrough',   icon: <IcStrike />,  md: ['~~','~~','text'] },
  { label: 'Heading',  cmd: 'heading',         icon: <span style={{fontSize:13,fontWeight:800,lineHeight:1}}>H</span>, md: null },
  { label: 'Link',     cmd: 'link',            icon: <IcLinkFmt />, md: null },
  { label: 'Quote',    cmd: 'quote',           icon: <IcQuote />,   md: null },
  { label: 'Code',     cmd: 'code',            icon: <IcCode />,    md: ['`','`','code'] },
  { label: 'List',     cmd: 'insertUnorderedList', icon: <IcList />,md: null },
  { label: 'Spoiler',  cmd: 'spoiler',         icon: <span style={{fontSize:11,fontWeight:700}}>◈</span>, md: ['>!','!<','spoiler'] },
];

function ToolbarBtn({ btn, onCmd, active }) {
  return (
    <button
      title={btn.label}
      onMouseDown={e => { e.preventDefault(); onCmd(btn.cmd); }}
      style={{
        background: active ? 'var(--bg-hover)' : 'none',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        border: 'none', cursor: 'pointer',
        padding: '5px 7px', borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'color 0.12s, background 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; } }}>
      {btn.icon}
    </button>
  );
}

function Editor({ value, onChange, placeholder, minHeight = 140 }) {
  const [mdMode, setMdMode] = React.useState(false);
  const [activeFormats, setActiveFormats] = React.useState({});
  const editableRef = React.useRef();
  const mdRef = React.useRef();
  // Track if we're syncing to avoid cursor jump
  const syncing = React.useRef(false);

  // When switching TO wysiwyg: set innerHTML from markdown value
  React.useEffect(() => {
    if (!mdMode && editableRef.current) {
      syncing.current = true;
      editableRef.current.innerHTML = mdToHtml(value);
      syncing.current = false;
    }
  }, [mdMode]);

  // Update active format state on selection change
  function updateFormats() {
    const el = editableRef.current;
    // If editor is empty, browser ghost-remembers the last format state.
    // Nuke it by removing all formatting so the next character starts clean.
    if (el && (el.innerHTML === '' || el.innerHTML === '<br>')) {
      ['bold','italic','strikeThrough'].forEach(cmd => {
        if (document.queryCommandState(cmd)) document.execCommand(cmd, false, null);
      });
      setActiveFormats({});
      return;
    }
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      strikeThrough: document.queryCommandState('strikeThrough'),
    });
  }

  function onInput() {
    if (syncing.current) return;
    const html = editableRef.current?.innerHTML || '';
    onChange(htmlToMd(html));
    updateFormats();
  }

  function execCmd(cmd) {
    if (mdMode) {
      // In markdown mode — insert syntax into textarea
      const el = mdRef.current;
      if (!el) return;
      const start = el.selectionStart, end = el.selectionEnd;
      const sel = value.slice(start, end);
      const before = value.slice(0, start), after = value.slice(end);

      if (cmd === 'bold')    { const t = sel||'bold text'; onChange(before+'**'+t+'**'+after); requestAnimationFrame(()=>{el.focus();el.setSelectionRange(start+2,start+2+(sel||'bold text').length);}); }
      else if (cmd==='italic') { const t=sel||'italic text'; onChange(before+'*'+t+'*'+after); requestAnimationFrame(()=>{el.focus();el.setSelectionRange(start+1,start+1+(sel||'italic text').length);}); }
      else if (cmd==='strikeThrough') { const t=sel||'text'; onChange(before+'~~'+t+'~~'+after); requestAnimationFrame(()=>{el.focus();el.setSelectionRange(start+2,start+2+(sel||'text').length);}); }
      else if (cmd==='code') { const t=sel||'code'; onChange(before+'`'+t+'`'+after); requestAnimationFrame(()=>{el.focus();el.setSelectionRange(start+1,start+1+(sel||'code').length);}); }
      else if (cmd==='spoiler') { const t=sel||'spoiler'; onChange(before+'>!'+t+'!<'+after); requestAnimationFrame(()=>{el.focus();el.setSelectionRange(start+2,start+2+(sel||'spoiler').length);}); }
      else if (cmd==='quote') { const ls=value.lastIndexOf('\n',start-1)+1; const le=value.indexOf('\n',start); const line=value.slice(ls,le===-1?undefined:le); const nl='> '+(line||'quote'); onChange(value.slice(0,ls)+nl+(le===-1?'':value.slice(le))); requestAnimationFrame(()=>{el.focus();const c=ls+nl.length;el.setSelectionRange(c,c);}); }
      else if (cmd==='heading') { const ls=value.lastIndexOf('\n',start-1)+1; const le=value.indexOf('\n',start); const line=value.slice(ls,le===-1?undefined:le); const m=line.match(/^(#{1,3}) /); const lvl=m?m[1].length:0; const next=lvl>=3?0:lvl+1; const stripped=line.replace(/^#{1,3} /,''); const nl=next===0?stripped:'#'.repeat(next)+' '+stripped; onChange(value.slice(0,ls)+nl+(le===-1?'':value.slice(le))); requestAnimationFrame(()=>{el.focus();el.setSelectionRange(ls+nl.length,ls+nl.length);}); }
      else if (cmd==='insertUnorderedList') { const ls=value.lastIndexOf('\n',start-1)+1; const le=value.indexOf('\n',start); const line=value.slice(ls,le===-1?undefined:le); const nl='- '+(line||'item'); onChange(value.slice(0,ls)+nl+(le===-1?'':value.slice(le))); requestAnimationFrame(()=>{el.focus();const c=ls+nl.length;el.setSelectionRange(c,c);}); }
      else if (cmd==='link') { const t=sel||'link text'; onChange(before+'['+t+'](url)'+after); requestAnimationFrame(()=>{el.focus();el.setSelectionRange(start+1,start+1+(sel||'link text').length);}); }
      return;
    }
    // WYSIWYG mode
    editableRef.current?.focus();
    if (cmd === 'heading') {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      let node = range.startContainer;
      while (node && node !== editableRef.current) {
        if (['H1','H2','H3'].includes(node.nodeName)) {
          // cycle or remove
          const lvl = parseInt(node.nodeName[1]);
          const next = lvl >= 3 ? 0 : lvl + 1;
          if (next === 0) { document.execCommand('formatBlock', false, 'p'); }
          else { document.execCommand('formatBlock', false, `h${next}`); }
          onInput(); return;
        }
        node = node.parentNode;
      }
      document.execCommand('formatBlock', false, 'h1');
    } else if (cmd === 'quote') {
      document.execCommand('formatBlock', false, 'blockquote');
    } else if (cmd === 'link') {
      const sel = window.getSelection();
      const text = sel?.toString() || 'link text';
      const url = prompt('Enter URL:');
      if (url) document.execCommand('createLink', false, url);
    } else if (cmd === 'spoiler') {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.className = 'spoiler';
      range.surroundContents(span);
    } else {
      document.execCommand(cmd, false, null);
    }
    onInput();
    updateFormats();
  }

  function toggleMode() {
    if (!mdMode) {
      // switching to markdown: already up to date via onInput
      setMdMode(true);
    } else {
      // switching to wysiwyg
      setMdMode(false);
      // useEffect will set innerHTML
    }
  }

  return (
    <div className="omni-page-enter" style={{ border: '1px solid var(--border-input)', borderRadius: 12, background: 'var(--bg-input)', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, padding: '5px 8px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {TOOLBAR_BTNS.map((btn, i) => (
          <ToolbarBtn key={i} btn={btn} onCmd={execCmd} active={!mdMode && !!activeFormats[btn.cmd]} />
        ))}
        {/* divider */}
        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 6px', flexShrink: 0 }} />
        {/* Mode toggle */}
        <button
          onMouseDown={e => { e.preventDefault(); toggleMode(); }}
          title={mdMode ? 'Switch to visual editor' : 'Switch to Markdown'}
          style={{
            background: mdMode ? 'var(--accent-glow)' : 'none',
            color: mdMode ? 'var(--accent)' : 'var(--text-muted)',
            border: mdMode ? '1px solid var(--accent)' : '1px solid transparent',
            borderRadius: 6, cursor: 'pointer',
            padding: '3px 8px', fontSize: 11, fontWeight: 700,
            fontFamily: 'monospace', transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { if (!mdMode) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; } }}
          onMouseLeave={e => { if (!mdMode) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; } }}>
          {mdMode ? 'Visual' : 'MD'}
        </button>
      </div>

      {/* WYSIWYG contenteditable */}
      {!mdMode && (
        <div
          ref={editableRef}
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          onKeyUp={updateFormats}
          onMouseUp={updateFormats}
          data-placeholder={placeholder}
          style={{
            minHeight, padding: '14px 16px',
            color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.65,
            outline: 'none', fontFamily: 'inherit',
          }}
        />
      )}

      {/* Markdown textarea */}
      {mdMode && (
        <textarea
          ref={mdRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.65,
            fontFamily: 'monospace', resize: 'vertical',
            padding: '14px 16px', minHeight,
          }}
        />
      )}

      {/* Inline styles for wysiwyg content */}
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--text-muted);
          pointer-events: none;
        }
        [contenteditable] h1 { font-size: 20px; font-weight: 700; margin: 4px 0; }
        [contenteditable] h2 { font-size: 17px; font-weight: 700; margin: 4px 0; }
        [contenteditable] h3 { font-size: 15px; font-weight: 700; margin: 4px 0; }
        [contenteditable] blockquote { border-left: 3px solid var(--accent); padding-left: 12px; color: var(--text-secondary); margin: 4px 0; }
        [contenteditable] code { background: var(--bg-hover); border-radius: 4px; padding: 1px 5px; font-family: monospace; font-size: 13px; }
        [contenteditable] a { color: var(--accent); text-decoration: underline; }
        [contenteditable] ul { padding-left: 20px; margin: 4px 0; }
        [contenteditable] .spoiler { background: var(--text-muted); color: var(--text-muted); border-radius: 3px; cursor: pointer; transition: all 0.2s; }
        [contenteditable] .spoiler:hover { background: transparent; color: var(--text-primary); }
      `}</style>
    </div>
  );
}

/* ── Media panel ────────────────────────────────────────────────────────── */
function MediaPanel({ attachments, setAttachments, content, setContent }) {
  const fileRef = useRef();
  const [idx, setIdx] = useState(0);
  const safeIdx = attachments.length === 0 ? 0 : Math.min(idx, attachments.length - 1);
  const [dragging, setDragging] = useState(false);

  function ingest(files) {
    const reads = Array.from(files).map(file => new Promise(res => {
      const mime = file.type;
      let kind = mime.startsWith('image/gif') ? 'GIF' : mime.startsWith('image/') ? 'IMAGE' : mime.startsWith('video/') ? 'VIDEO' : null;
      if (!kind) return res(null);
      const reader = new FileReader();
      reader.onload = ev => res({ file, dataUrl: ev.target.result, kind });
      reader.readAsDataURL(file);
    }));
    Promise.all(reads).then(r => {
      const valid = r.filter(Boolean);
      setAttachments(prev => { const next = [...prev, ...valid]; setIdx(next.length - 1); return next; });
    });
  }

  function onDrop(e) {
    e.preventDefault(); setDragging(false);
    ingest(e.dataTransfer.files);
  }

  const navBtn = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', border: 'none', color: '#fff', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, transition: 'background 0.15s' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input ref={fileRef} type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} onChange={e => { ingest(e.target.files); e.target.value = ''; }} />

      {attachments.length === 0 ? (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            width: '100%', minHeight: 180, border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-input)'}`,
            borderRadius: 14, background: dragging ? 'var(--bg-hover)' : 'var(--bg-input)',
            cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10,
            color: 'var(--text-muted)', transition: 'all 0.15s',
          }}>
          <IcUpload />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Drop files here or click to upload</div>
            <div style={{ fontSize: 12 }}>Images, GIFs, videos</div>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000', aspectRatio: '16/9' }}>
            {attachments[safeIdx].kind === 'VIDEO'
              ? <video src={attachments[safeIdx].dataUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} controls />
              : <img src={attachments[safeIdx].dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            }
            {safeIdx > 0 && (
              <button onClick={() => setIdx(i => i - 1)} style={{ ...navBtn, left: 10 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}><IcChevL /></button>
            )}
            {safeIdx < attachments.length - 1 && (
              <button onClick={() => setIdx(i => i + 1)} style={{ ...navBtn, right: 10 }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}><IcChevR /></button>
            )}
            <button onClick={() => setAttachments(prev => { const next = prev.filter((_, i) => i !== safeIdx); setIdx(i => Math.max(0, Math.min(i, next.length - 1))); return next; })}
              style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IcClose />
            </button>
            <span style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 2, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>{attachments[safeIdx].kind}</span>
            {attachments.length > 1 && <span style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 2, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10 }}>{safeIdx + 1} / {attachments.length}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 }}>
            {attachments.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)} style={{ width: i === safeIdx ? 18 : 7, height: 7, borderRadius: 4, padding: 0, background: i === safeIdx ? 'var(--accent)' : 'var(--border-input)', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }} />
            ))}
            <button onClick={() => fileRef.current?.click()} title="Add more"
              style={{ width: 26, height: 26, borderRadius: '50%', padding: 0, border: '2px dashed var(--border-input)', background: 'var(--bg-input)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', marginLeft: 4, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
              <IcPlus />
            </button>
          </div>
        </div>
      )}
      <Editor value={content} onChange={setContent} placeholder="Caption (optional)" minHeight={90} />
    </div>
  );
}

/* ── Poll panel ─────────────────────────────────────────────────────────── */
function PollPanel({ options, setOptions }) {
  function update(i, v) { setOptions(p => p.map((o, j) => j === i ? v : o)); }
  function remove(i) { if (options.length > 2) setOptions(p => p.filter((_, j) => j !== i)); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map((opt, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>{i + 1}</div>
          <input
            value={opt} onChange={e => update(i, e.target.value)}
            placeholder={`Option ${i + 1}`} maxLength={60}
            style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 10, padding: '11px 14px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', transition: 'border-color 0.15s' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-input)'}
          />
          {options.length > 2 && (
            <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#e06060'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <IcClose />
            </button>
          )}
        </div>
      ))}
      {options.length < 6 && (
        <button onClick={() => setOptions(p => [...p, ''])}
          style={{ background: 'none', border: '1px dashed var(--border-input)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, textAlign: 'left', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
          <IcPlus /> Add option
        </button>
      )}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */
export default function Create() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initType = (() => {
    const t = searchParams.get('tab');
    if (t === 'images') return 'Media';
    if (t === 'link')   return 'Link';
    if (t === 'poll')   return 'Poll';
    return 'Text';
  })();

  const [type,        setType]        = useState(initType);
  const [title,       setTitle]       = useState('');
  const [content,     setContent]     = useState('');
  const [linkUrl,     setLinkUrl]     = useState('');
  const [attachments, setAttachments] = useState([]);
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const TITLE_LIMIT = 300;

  const avatarSrc = user?.profilePicture
    ? (user.profilePicture.startsWith('http') ? user.profilePicture : `${API_BASE}${user.profilePicture}`)
    : null;
  const initials = (user?.username || '?').slice(0, 2).toUpperCase();

  function canPost() {
    if (!title.trim()) return false;
    if (type === 'Link' && !linkUrl.trim()) return false;
    if (type === 'Poll' && pollOptions.filter(o => o.trim()).length < 2) return false;
    return true;
  }

  async function handlePost() {
    if (!canPost() || submitting) return;
    setSubmitting(true); setError('');
    try {
      const fd = new FormData();
      fd.append('authorId', user.id);
      fd.append('title', title.trim());
      let body = content.trim();
      if (type === 'Link' && linkUrl.trim()) body = (body ? body + '\n\n' : '') + linkUrl.trim();
      if (type === 'Poll') {
        const opts = pollOptions.filter(o => o.trim());
        body = (body ? body + '\n\n' : '') + '[Poll]\n' + opts.map((o, i) => `${i + 1}. ${o}`).join('\n');
      }
      if (body) fd.append('content', body);
      attachments.forEach(a => fd.append('media', a.file));
      await api.createPost(fd);
      navigate('/');
    } catch { setError('Failed to post. Try again.'); }
    finally { setSubmitting(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-body)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg-body)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Avatar */}
          {avatarSrc
            ? <img src={avatarSrc} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-input)' }} />
            : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>{initials}</div>
          }
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>New post</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/')}
            style={{ background: 'none', border: '1px solid var(--border-input)', color: 'var(--text-secondary)', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
            Discard
          </button>
          <button onClick={handlePost} disabled={submitting || !canPost()}
            style={{ background: canPost() ? 'var(--gradient)' : 'var(--bg-hover)', border: 'none', color: canPost() ? '#fff' : 'var(--text-muted)', borderRadius: 20, padding: '6px 20px', fontSize: 13, fontWeight: 700, cursor: canPost() ? 'pointer' : 'default', transition: 'all 0.15s', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, maxWidth: 680, width: '100%', margin: '0 auto', padding: '28px 24px 60px', boxSizing: 'border-box' }}>

        {/* Post type selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 }}>
          {POST_TYPES.map(({ id, label, icon: Icon }) => {
            const active = type === id;
            return (
              <button key={id} onClick={() => setType(id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '14px 10px', borderRadius: 12, cursor: 'pointer',
                  border: active ? '2px solid var(--accent)' : '2px solid var(--border-input)',
                  background: active ? 'var(--accent-glow)' : 'var(--bg-card)',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.color = 'var(--text-muted)'; } }}>
                <Icon />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Title */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <textarea
            value={title}
            onChange={e => { if (e.target.value.length <= TITLE_LIMIT) setTitle(e.target.value); }}
            placeholder="Title"
            rows={2}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'none',
              background: 'var(--bg-card)', border: '1px solid var(--border-input)',
              borderRadius: 12, padding: '14px 16px 28px',
              color: 'var(--text-primary)', fontSize: 18, fontWeight: 700,
              fontFamily: 'inherit', lineHeight: 1.4, outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-input)'}
          />
          <span style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 11, color: title.length > TITLE_LIMIT * 0.85 ? '#e06060' : 'var(--text-muted)' }}>{title.length}/{TITLE_LIMIT}</span>
        </div>

        {/* Content area by type */}
        {type === 'Text' && (
          <Editor value={content} onChange={setContent} placeholder="What's on your mind?" minHeight={180} />
        )}

        {type === 'Media' && (
          <MediaPanel attachments={attachments} setAttachments={setAttachments} content={content} setContent={setContent} />
        )}

        {type === 'Link' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}><IcLink /></div>
              <input
                value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                placeholder="Paste a URL"
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-card)', border: '1px solid var(--border-input)', borderRadius: 12, padding: '13px 16px 13px 42px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', transition: 'border-color 0.15s', fontFamily: 'inherit' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-input)'}
              />
            </div>
            <Editor value={content} onChange={setContent} placeholder="Add a comment (optional)" minHeight={120} />
          </div>
        )}

        {type === 'Poll' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <PollPanel options={pollOptions} setOptions={setPollOptions} />
            <Editor value={content} onChange={setContent} placeholder="Add context (optional)" minHeight={100} />
          </div>
        )}

        {error && (
          <div style={{ marginTop: 16, background: 'rgba(224,96,96,0.1)', border: '1px solid rgba(224,96,96,0.3)', borderRadius: 10, padding: '10px 14px', color: '#e06060', fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
