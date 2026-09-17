import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE, groupApi } from '../services/api';
import UserAvatar from './UserAvatar';
import toast from 'react-hot-toast';

/* ── helpers ── */
function avatarSrc(pic) {
  if (!pic) return null;
  return pic.startsWith('http') ? pic : `${API_BASE}${pic}`;
}

function useIsDesktop() {
  const [v, setV] = useState(() => window.matchMedia('(min-width:769px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width:769px)');
    const h = e => setV(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return v;
}

/* ── icon set ── */
const Ic = ({ d, size = 18, stroke = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} width={size} height={size}>
    {d}
  </svg>
);

const Icons = {
  Back:     <Ic d={<polyline points="15 18 9 12 15 6" />} size={22} stroke={2.5} />,
  Edit:     <Ic d={<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>} />,
  Phone:    <Ic d={<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.36 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>} size={20} />,
  Video:    <Ic d={<><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>} size={20} />,
  UserPlus: <Ic d={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></>} size={20} />,
  Search:   <Ic d={<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>} />,
  Photos:   <Ic d={<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>} />,
  Star:     <Ic d={<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>} />,
  Bookmark: <Ic d={<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>} />,
  Bell:     <Ic d={<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>} />,
  Lock:     <Ic d={<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>} />,
  Clock:    <Ic d={<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>} />,
  Shield:   <Ic d={<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>} />,
  Sliders:  <Ic d={<><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></>} />,
  Chevron:  <Ic d={<polyline points="9 18 15 12 9 6"/>} size={16} />,
  Leave:    <Ic d={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>} size={20} />,
  Flag:     <Ic d={<><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>} size={20} />,
  Check:    <Ic d={<polyline points="20 6 9 17 4 12"/>} size={16} stroke={2.5} />,
  X:        <Ic d={<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>} />,
  UserMinus:<Ic d={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="9" x2="16" y2="9"/></>} size={16} />,
  File:     <Ic d={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>} />,
  Link:     <Ic d={<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>} />,
  Camera:   <Ic d={<><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>} size={20} />,
};

/* ── sub-components ── */
function Row({ icon, label, value, danger, onClick, noBorder, chevron, toggle, checked, onToggle }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onClick && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px',
        cursor: onClick ? 'pointer' : 'default',
        borderBottom: noBorder ? 'none' : '1px solid var(--border)',
        background: hov ? 'var(--bg-hover)' : 'transparent',
        transition: 'background 0.12s',
      }}>
      {icon && <span style={{ color: danger ? '#ef4444' : 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>{icon}</span>}
      <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: danger ? '#ef4444' : 'var(--text-primary)' }}>{label}</span>
      {value !== undefined && (
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)', marginRight: chevron ? 2 : 0, maxWidth: 180, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </span>
      )}
      {toggle && (
        <label className="toggle-switch" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={!!checked} onChange={onToggle} />
          <span className="toggle-slider" />
        </label>
      )}
      {chevron && <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{Icons.Chevron}</span>}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ padding: '16px 20px 6px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
      {children}
    </div>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          flex: 1, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13.5, fontWeight: 600,
          color: active === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
          borderBottom: active === t.id ? '2px solid var(--accent)' : '2px solid transparent',
          transition: 'color 0.12s',
        }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, desc }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '60px 32px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-hover)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', marginBottom: 4 }}>
        {icon}
      </div>
      <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
      {desc && <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, maxWidth: 240 }}>{desc}</span>}
    </div>
  );
}

/* ── Media / Docs / Links sub-view ── */
function MediaView({ mediaItems, docItems, linkItems, activeTab, setActiveTab }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <TabBar tabs={[{ id: 'media', label: `Media (${mediaItems.length})` }, { id: 'docs', label: `Docs (${docItems.length})` }, { id: 'links', label: `Links (${linkItems.length})` }]} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'media' && (
        mediaItems.length === 0
          ? <EmptyState icon={Icons.Photos} title="No media yet" desc="Photos and videos shared in this group will appear here." />
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, padding: 2 }}>
            {mediaItems.map((m, i) => (
              <div key={i} style={{ aspectRatio: '1', overflow: 'hidden', background: 'var(--bg-hover)', position: 'relative', cursor: 'pointer' }}>
                {(m.type || '').toUpperCase() === 'VIDEO'
                  ? <video src={avatarSrc(m.fileUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <img src={avatarSrc(m.fileUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />}
              </div>
            ))}
          </div>
      )}
      {activeTab === 'docs' && (
        docItems.length === 0
          ? <EmptyState icon={Icons.File} title="No documents" desc="Files shared in this group will appear here." />
          : <div>
            {docItems.map((m, i) => (
              <a key={i} href={avatarSrc(m.fileUrl)} target="_blank" rel="noreferrer" download
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text-primary)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-hover)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)' }}>{Icons.File}</div>
                <span style={{ fontSize: 13.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.fileUrl.split('/').pop()}</span>
              </a>
            ))}
          </div>
      )}
      {activeTab === 'links' && (
        linkItems.length === 0
          ? <EmptyState icon={Icons.Link} title="No links" desc="Links shared in this group will appear here." />
          : <div>
            {linkItems.map((m, i) => (
              <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                <a href={m.content} target="_blank" rel="noreferrer" style={{ fontSize: 13.5, color: 'var(--accent)', wordBreak: 'break-all', textDecoration: 'none' }}>{m.content}</a>
              </div>
            ))}
          </div>
      )}
    </div>
  );
}

/* ── Notifications sub-view ── */
function NotificationsView({ muted, setMuted }) {
  const [mutedCalls, setMutedCalls] = useState(false);
  const [tone, setTone] = useState('Default');
  return (
    <div>
      <SectionLabel>Messages</SectionLabel>
      <Row icon={Icons.Bell} label="Mute notifications" toggle checked={muted} onToggle={e => setMuted(e.target.checked)} noBorder />
      <SectionLabel>Notification tone</SectionLabel>
      <div style={{ padding: '4px 20px 16px' }}>
        <select value={tone} onChange={e => setTone(e.target.value)}
          style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 10, padding: '10px 12px', color: 'var(--text-primary)', fontSize: 13.5 }}>
          <option>Default</option><option>Chime</option><option>Pulse</option><option>None</option>
        </select>
      </div>
      <div style={{ borderTop: '1px solid var(--border)' }} />
      <SectionLabel>Calls</SectionLabel>
      <Row icon={Icons.Phone} label="Mute calls" toggle checked={mutedCalls} onToggle={e => setMutedCalls(e.target.checked)} noBorder />
    </div>
  );
}

/* ── Permissions sub-view ── */
function PermissionsView({ isAdmin, group, currentUserId, onGroupUpdated }) {
  const [perms, setPerms] = useState({
    editSettings: !!group.permEditSettings,
    sendMessages: group.permSendMessages !== false,
    addMembers:   !!group.permAddMembers,
  });
  const [saving, setSaving] = useState(null);

  async function toggle(k) {
    if (!isAdmin) { toast('Only the group admin can change permissions', { icon: '🔒' }); return; }
    const next = { ...perms, [k]: !perms[k] };
    setPerms(next);
    setSaving(k);
    try {
      const keyMap = { editSettings: 'permEditSettings', sendMessages: 'permSendMessages', addMembers: 'permAddMembers' };
      const updated = await groupApi.updatePermissions(group.groupId || group.id, { [keyMap[k]]: next[k] });
      onGroupUpdated({ ...group, ...updated });
      toast.success('Permission updated');
    } catch {
      setPerms(perms); // revert on failure
      toast.error('Failed to update permission');
    }
    setSaving(null);
  }

  const rows = [
    { k: 'editSettings', icon: Icons.Edit,     label: 'Edit group settings', desc: 'Name, icon, and description.' },
    { k: 'sendMessages', icon: Icons.Bell,      label: 'Send messages',       desc: 'Members can send messages in this group.' },
    { k: 'addMembers',   icon: Icons.UserPlus,  label: 'Add members',         desc: 'Members can invite others to join.' },
  ];

  return (
    <div>
      {!isAdmin && (
        <div style={{ margin: '12px 16px', padding: '10px 14px', background: 'rgba(130,90,255,0.08)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Only the group admin can change these settings.
        </div>
      )}
      <SectionLabel>Members can</SectionLabel>
      {rows.map(r => (
        <div key={r.k} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--border)', opacity: saving === r.k ? 0.6 : 1, transition: 'opacity 0.15s' }}>
          <span style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }}>{r.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{r.label}</div>
            {r.desc && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.45 }}>{r.desc}</div>}
          </div>
          <label className="toggle-switch" style={{ marginTop: 2, flexShrink: 0, cursor: isAdmin ? 'pointer' : 'not-allowed' }}>
            <input type="checkbox" checked={!!perms[r.k]} onChange={() => toggle(r.k)} disabled={saving === r.k} />
            <span className="toggle-slider" />
          </label>
        </div>
      ))}
    </div>
  );
}

/* ── Action button (hero row) ── */
function HeroBtn({ icon, label, onClick, danger }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      <div style={{
        width: 50, height: 50, borderRadius: '50%',
        background: hov ? (danger ? 'rgba(239,68,68,0.12)' : 'var(--accent)') : 'var(--bg-hover)',
        border: '1px solid var(--border-input)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: hov ? (danger ? '#ef4444' : 'var(--accent-text)') : (danger ? '#ef4444' : 'var(--text-primary)'),
        transition: 'all 0.15s',
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 11, color: danger ? '#ef4444' : 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN GroupInfoPanel
══════════════════════════════════════════ */
export default function GroupInfoPanel({ group, currentUserId, conversations, messages, onClose, onGroupUpdated, onStartCall, onSearchInGroup }) {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r); }, []);

  // navigation
  const [view, setView] = useState(null); // null | 'media' | 'notifications' | 'permissions' | 'search' | 'starred'
  const [searchQ, setSearchQ2] = useState('');
  const [mediaTab, setMediaTab] = useState('media');

  // editable state
  const [members, setMembers] = useState(group.members || []);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(group.name || '');
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(group.description || '');
  const [descDraft, setDescDraft] = useState(group.description || '');
  const [muted, setMuted] = useState(!!group.muted);
  const [photoHov, setPhotoHov] = useState(false);

  // add members
  const [addingMembers, setAddingMembers] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [toAdd, setToAdd] = useState([]);

  // member search filter
  const [memberSearch, setMemberSearch] = useState('');

  // confirm dialogs
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);

  const [busy, setBusy] = useState(false);

  const isAdmin = group.creatorId === currentUserId;
  const groupId = group.groupId || group.id;

  // derived media
  const mediaItems = (messages || []).filter(m => ['IMAGE', 'GIF', 'VIDEO'].includes((m.type || '').toUpperCase()) && m.fileUrl);
  const docItems   = (messages || []).filter(m => (m.type || '').toUpperCase() === 'FILE' && m.fileUrl);
  const linkRegex  = /(https?:\/\/[^\s]+)/gi;
  const starredItems = (messages || []).filter(m => m.starred);
  const linkItems  = (messages || []).filter(m => m.content && linkRegex.test(m.content));

  const filteredMembers = memberSearch.trim()
    ? members.filter(m => {
        const q = memberSearch.toLowerCase();
        return (m.displayName || '').toLowerCase().includes(q) || (m.username || '').toLowerCase().includes(q);
      })
    : members;

  function soon(label) { toast(`${label} — coming soon`, { icon: '🛠️' }); }

  // user search for add-member
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      api.searchUsers(searchQ).then(r => {
        const ids = new Set(members.map(m => m.id));
        setSearchResults(r.filter(u => u.id !== currentUserId && !ids.has(u.id)));
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ, members, currentUserId]);

  /* ── actions ── */
  async function submitRename() {
    if (!newName.trim() || newName.trim() === group.name) { setRenaming(false); return; }
    setBusy(true);
    try {
      await groupApi.rename(groupId, newName.trim());
      onGroupUpdated({ ...group, name: newName.trim() });
      toast.success('Group renamed');
    } catch { toast.error('Failed to rename'); }
    setBusy(false);
    setRenaming(false);
  }

  async function saveDesc() {
    setDesc(descDraft.trim());
    setEditingDesc(false);
    onGroupUpdated({ ...group, description: descDraft.trim() });
    toast.success('Description saved');
  }

  async function submitAddMembers() {
    if (!toAdd.length) { setAddingMembers(false); return; }
    setBusy(true);
    try {
      await groupApi.addMembers(groupId, toAdd.map(u => u.id));
      const newList = [...members, ...toAdd.map(u => ({ id: u.id, username: u.username, displayName: u.displayName, avatar: u.profilePicture }))];
      setMembers(newList);
      onGroupUpdated({ ...group, members: newList });
      toast.success(`Added ${toAdd.length} member${toAdd.length > 1 ? 's' : ''}`);
    } catch { toast.error('Failed to add members'); }
    setBusy(false);
    setAddingMembers(false);
    setToAdd([]);
    setSearchQ('');
  }

  async function removeMember(memberId) {
    setBusy(true);
    try {
      await groupApi.removeMember(groupId, memberId);
      const newList = members.filter(m => m.id !== memberId);
      setMembers(newList);
      onGroupUpdated({ ...group, members: newList });
      toast.success('Member removed');
    } catch { toast.error('Failed to remove member'); }
    setBusy(false);
    setRemoveTarget(null);
  }

  async function leaveGroup() {
    setBusy(true);
    try {
      await groupApi.leave(groupId);
      onGroupUpdated(null);
      onClose();
      toast('You left the group');
    } catch { toast.error('Failed to leave group'); }
    setBusy(false);
  }

  /* ── title for top bar ── */
  const viewTitle = view === 'media' ? 'Media, docs & links'
    : view === 'notifications' ? 'Notifications'
    : view === 'permissions' ? 'Group permissions'
    : view === 'search' ? 'Search in group'
    : view === 'starred' ? 'Starred messages'
    : 'Group info';

  const panelContent = (
    <>
      <style>{`
        @keyframes giSlideIn { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
        .gi-btn-row-item:hover { background: var(--bg-hover) !important; }
        .gi-member:hover { background: var(--bg-hover) !important; }
        .gi-danger-row:hover { background: rgba(239,68,68,0.07) !important; }
      `}</style>

      <div style={isDesktop ? {
        width: mounted ? 368 : 0,
        minWidth: mounted ? 368 : 0,
        flexShrink: 0,
        height: '100%',
        borderLeft: mounted ? '1px solid var(--border)' : 'none',
        overflow: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.32,0.72,0,1), min-width 0.3s cubic-bezier(0.32,0.72,0,1)',
      } : {
        position: 'fixed', inset: 0, zIndex: 900, background: 'var(--bg-primary)',
        display: 'flex', flexDirection: 'column', animation: 'giSlideIn 0.2s ease',
      }}>
        <div style={isDesktop ? {
          width: 368, height: '100%', display: 'flex', flexDirection: 'column',
          transform: mounted ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        } : { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

          {/* ── Top bar ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: isDesktop ? 'transparent' : 'var(--bg-card)' }}>
            <button onClick={() => view ? setView(null) : onClose()} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 6, display: 'flex', borderRadius: 8 }}>
              {Icons.Back}
            </button>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>{viewTitle}</span>
            {!view && isAdmin && (
              <button onClick={() => { setNewName(group.name); setRenaming(true); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6, display: 'flex', borderRadius: 8 }}>
                {Icons.Edit}
              </button>
            )}
          </div>

          {/* ── Scrollable body ── */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>

            {/* Sub-views */}
            {view === 'media' && <MediaView mediaItems={mediaItems} docItems={docItems} linkItems={linkItems} activeTab={mediaTab} setActiveTab={setMediaTab} />}
            {view === 'notifications' && <NotificationsView muted={muted} setMuted={v => { setMuted(v); onGroupUpdated({ ...group, muted: v }); }} />}
            {view === 'permissions' && <PermissionsView isAdmin={isAdmin} group={group} currentUserId={currentUserId} onGroupUpdated={onGroupUpdated} />}
            {view === 'search' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-hover)', borderRadius: 10, padding: '9px 12px', border: '1px solid var(--border)' }}>
                    {Icons.Search}
                    <input autoFocus value={searchQ} onChange={e => setSearchQ2(e.target.value)} placeholder="Search messages…"
                      style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13.5 }} />
                    {searchQ && <button onClick={() => setSearchQ2('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}>{Icons.X}</button>}
                  </div>
                </div>
                {searchQ.trim() ? (() => {
                  const q = searchQ.toLowerCase();
                  const results = (messages || []).filter(m => m.content && m.content.toLowerCase().includes(q) && m.type !== 'DELETE');
                  return results.length === 0
                    ? <EmptyState icon={Icons.Search} title="No results" desc={`No messages containing "${searchQ}"`} />
                    : results.map(m => (
                      <div key={m.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600, marginBottom: 3 }}>{m.senderDisplayName || m.senderUsername || 'You'}</div>
                        <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.45 }}>
                          {m.content.split(new RegExp(`(${searchQ})`, 'gi')).map((part, i) =>
                            part.toLowerCase() === searchQ.toLowerCase()
                              ? <mark key={i} style={{ background: 'var(--accent)', color: '#fff', borderRadius: 3, padding: '0 2px' }}>{part}</mark>
                              : part
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{new Date(m.createdAt || m.sentAt).toLocaleString()}</div>
                      </div>
                    ));
                })() : <EmptyState icon={Icons.Search} title="Search messages" desc="Type to search through this group's messages." />}
              </div>
            )}
            {view === 'starred' && (
              starredItems.length === 0
                ? <EmptyState icon={Icons.Star} title="No starred messages" desc="Star messages in the chat to save them here." />
                : starredItems.map(m => (
                  <div key={m.id} style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600, marginBottom: 3 }}>{m.senderDisplayName || m.senderUsername || 'You'}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.45 }}>{m.content}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{new Date(m.createdAt || m.sentAt).toLocaleString()}</div>
                  </div>
                ))
            )}

            {/* ── Main view ── */}
            {!view && (
              <>
                {/* Hero */}
                <div style={{ padding: '32px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                  {/* Group avatar with optional camera overlay for admin */}
                  <div
                    style={{ width: 92, height: 92, borderRadius: '50%', position: 'relative', marginBottom: 16, cursor: isAdmin ? 'pointer' : 'default', flexShrink: 0 }}
                    onMouseEnter={() => isAdmin && setPhotoHov(true)}
                    onMouseLeave={() => setPhotoHov(false)}
                    onClick={() => isAdmin && soon('Change group photo')}>
                    <div style={{ width: 92, height: 92, borderRadius: '50%', background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px var(--accent-glow)' }}>
                      <svg viewBox="0 0 24 24" fill="white" width="40" height="40"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    {isAdmin && photoHov && (
                      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                        {Icons.Camera}
                      </div>
                    )}
                  </div>

                  {/* Name / rename */}
                  {renaming ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 300, marginBottom: 6 }}>
                      <input
                        autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(false); }}
                        style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--accent)', borderRadius: 12, padding: '9px 14px', color: 'var(--text-primary)', fontSize: 17, fontWeight: 700, outline: 'none', textAlign: 'center' }}
                      />
                      <button onClick={submitRename} disabled={busy} style={{ background: 'var(--gradient)', border: 'none', borderRadius: 10, padding: '9px 14px', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12.5 }}>Save</button>
                      <button onClick={() => setRenaming(false)} style={{ background: 'none', border: '1px solid var(--border-input)', borderRadius: 10, padding: '9px 10px', color: 'var(--text-muted)', cursor: 'pointer' }}>{Icons.X}</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 21, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 4 }}>{group.name}</span>
                  )}
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 22 }}>Group · {members.length} members</span>

                  {/* Hero action buttons */}
                  <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
                    <HeroBtn icon={Icons.Phone} label="Voice" onClick={() => onStartCall ? onStartCall('audio') : soon('Group voice call')} />
                    <HeroBtn icon={Icons.Video} label="Video" onClick={() => onStartCall ? onStartCall('video') : soon('Group video call')} />
                    {isAdmin && <HeroBtn icon={Icons.UserPlus} label="Add" onClick={() => setAddingMembers(true)} />}
                    <HeroBtn icon={Icons.Search} label="Search" onClick={() => onSearchInGroup ? onSearchInGroup() : setView('search')} />
                  </div>
                </div>

                {/* Description */}
                <div style={{ borderBottom: '1px solid var(--border)', padding: '14px 20px' }}>
                  {editingDesc ? (
                    <>
                      <textarea autoFocus value={descDraft} onChange={e => setDescDraft(e.target.value)}
                        placeholder="Add a group description…" rows={3}
                        style={{ width: '100%', resize: 'none', background: 'var(--bg-input)', border: '1px solid var(--accent)', borderRadius: 10, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                        <button onClick={() => { setEditingDesc(false); setDescDraft(desc); }} style={{ background: 'none', border: '1px solid var(--border-input)', borderRadius: 10, padding: '7px 14px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>Cancel</button>
                        <button onClick={saveDesc} style={{ background: 'var(--gradient)', border: 'none', borderRadius: 10, padding: '7px 14px', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }}>Save</button>
                      </div>
                    </>
                  ) : desc ? (
                    <div onClick={() => isAdmin && setEditingDesc(true)} style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, cursor: isAdmin ? 'pointer' : 'default', whiteSpace: 'pre-wrap' }}>{desc}</div>
                  ) : isAdmin ? (
                    <span onClick={() => setEditingDesc(true)} style={{ fontSize: 13.5, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}>+ Add group description</span>
                  ) : (
                    <span style={{ fontSize: 13.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>No description</span>
                  )}
                </div>

                {/* Quick rows: media, notifications etc. */}
                <div style={{ borderBottom: '1px solid var(--border)' }}>
                  <Row icon={Icons.Photos} label="Media, docs & links" value={mediaItems.length > 0 ? `${mediaItems.length} item${mediaItems.length !== 1 ? 's' : ''}` : undefined} chevron onClick={() => setView('media')} />
                  <Row icon={Icons.Star} label="Starred messages" value={starredItems.length > 0 ? `${starredItems.length}` : undefined} chevron onClick={() => setView('starred')} />
                  <Row icon={Icons.Bell} label="Notifications" chevron onClick={() => setView('notifications')} />
                  <Row icon={Icons.Lock} label="Encryption" value="End-to-end encrypted" onClick={() => soon('Encryption info')} />
                  <Row icon={Icons.Clock} label="Disappearing messages" value="Off" chevron onClick={() => soon('Disappearing messages')} />
                  <Row icon={Icons.Sliders} label="Group permissions" chevron onClick={() => setView('permissions')} noBorder />
                </div>

                {/* ── Members section ── */}
                <div style={{ borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 10px' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{members.length} members</span>
                  </div>

                  {/* Member search */}
                  {members.length > 4 && (
                    <div style={{ padding: '0 16px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-hover)', borderRadius: 10, padding: '8px 12px', border: '1px solid var(--border)' }}>
                        {Icons.Search}
                        <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search members…"
                          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13 }} />
                        {memberSearch && <button onClick={() => setMemberSearch('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}>{Icons.X}</button>}
                      </div>
                    </div>
                  )}

                  {/* Add member row */}
                  {isAdmin && !addingMembers && (
                    <div className="gi-member" onClick={() => setAddingMembers(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 20px', cursor: 'pointer', transition: 'background 0.12s', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" width="20" height="20"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>Add members</span>
                    </div>
                  )}

                  {/* Add member search panel */}
                  {addingMembers && (
                    <div style={{ padding: '12px 16px', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <input autoFocus value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search users…"
                          style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 10, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
                        <button onClick={submitAddMembers} disabled={!toAdd.length || busy}
                          style={{ background: toAdd.length ? 'var(--gradient)' : 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: 10, padding: '8px 14px', color: toAdd.length ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, opacity: !toAdd.length ? 0.5 : 1 }}>
                          Add
                        </button>
                        <button onClick={() => { setAddingMembers(false); setToAdd([]); setSearchQ(''); }}
                          style={{ background: 'none', border: '1px solid var(--border-input)', borderRadius: 10, padding: '8px 10px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                          {Icons.X}
                        </button>
                      </div>
                      {toAdd.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          {toAdd.map(u => (
                            <span key={u.id} style={{ background: 'rgba(130,90,255,0.12)', border: '1px solid var(--accent)', borderRadius: 20, padding: '3px 10px', fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 5 }}>
                              {u.displayName || u.username}
                              <span onClick={() => setToAdd(p => p.filter(x => x.id !== u.id))} style={{ cursor: 'pointer', opacity: 0.7, display: 'flex' }}>{Icons.X}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {searchResults.map(u => {
                        const sel = toAdd.some(x => x.id === u.id);
                        return (
                          <div key={u.id} onClick={() => setToAdd(p => sel ? p.filter(x => x.id !== u.id) : [...p, u])}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderRadius: 8, cursor: 'pointer', background: sel ? 'rgba(130,90,255,0.08)' : 'transparent' }}>
                            <UserAvatar src={u.profilePicture} name={u.displayName || u.username} userId={u.id} size={36} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{u.displayName || u.username}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{u.username}</div>
                            </div>
                            {sel && <span style={{ color: 'var(--accent)', display: 'flex' }}>{Icons.Check}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Member list */}
                  {filteredMembers.map(m => {
                    const name = m.displayName || m.username || '?';
                    const isCreator = m.id === group.creatorId;
                    const isMe = m.id === currentUserId;
                    const isTarget = removeTarget === m.id;
                    return (
                      <div key={m.id} className="gi-member"
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', cursor: 'pointer', transition: 'background 0.12s', borderTop: '1px solid var(--border)' }}
                        onClick={() => { if (!isMe) navigate(`/profile/${m.username}`); }}>
                        <UserAvatar src={m.avatar} name={name} userId={m.id} size={44} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isMe ? 'You' : name}
                            {isCreator && (
                              <span title="Group creator" style={{ fontSize: 13, lineHeight: 1 }}>👑</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>@{m.username}</div>
                        </div>

                        {/* Remove / confirm buttons */}
                        {!isMe && isAdmin && !isTarget && (
                          <button onClick={e => { e.stopPropagation(); setRemoveTarget(m.id); }}
                            title="Remove member"
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6, display: 'flex', borderRadius: 8, opacity: 0 }}
                            className="gi-remove-btn"
                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                            {Icons.UserMinus}
                          </button>
                        )}
                        {isTarget && (
                          <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => removeMember(m.id)} disabled={busy}
                              style={{ background: '#ef4444', border: 'none', borderRadius: 8, padding: '5px 10px', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                              Remove
                            </button>
                            <button onClick={() => setRemoveTarget(null)}
                              style={{ background: 'none', border: '1px solid var(--border-input)', borderRadius: 8, padding: '5px 10px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredMembers.length === 0 && memberSearch && (
                    <div style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No members match "{memberSearch}"</div>
                  )}
                </div>

                {/* ── Danger zone ── */}
                <div style={{ borderBottom: '1px solid var(--border)', marginTop: 8 }}>
                  {!confirmLeave ? (
                    <>
                      <button className="gi-danger-row" onClick={() => setConfirmLeave(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '15px 20px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: '#ef4444', fontSize: 14, fontWeight: 600, transition: 'background 0.12s', textAlign: 'left' }}>
                        {Icons.Leave}
                        Exit group
                      </button>
                      <button className="gi-danger-row" onClick={() => soon('Report group')}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '15px 20px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, fontWeight: 600, transition: 'background 0.12s', textAlign: 'left' }}>
                        {Icons.Flag}
                        Report group
                      </button>
                    </>
                  ) : (
                    <div style={{ padding: '16px 20px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Leave "{group.name}"?</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>You'll stop receiving messages from this group. You can only rejoin if an admin adds you.</div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={leaveGroup} disabled={busy}
                          style={{ flex: 1, padding: '10px 0', background: '#ef4444', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                          Leave
                        </button>
                        <button onClick={() => setConfirmLeave(false)}
                          style={{ flex: 1, padding: '10px 0', background: 'none', border: '1px solid var(--border-input)', borderRadius: 12, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ height: 40 }} />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );

  if (!isDesktop) return ReactDOM.createPortal(panelContent, document.body);
  return panelContent;
}
