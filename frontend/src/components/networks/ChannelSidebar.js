import React, { useState, useRef, useLayoutEffect } from 'react';
import { API_BASE, resolveUrl } from '../../services/api';

const TYPE_ICON = {
  TEXT: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>,
  VOICE: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>,
  ANNOUNCEMENT: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a2 2 0 1 1-3.2 2.4"/></svg>,
};

// Every dropdown in this sidebar (server menu, category kebab, move-to-category)
// used to be `position: absolute` anchored to something inside the sidebar's
// own `overflow: auto` scroll container. That's a classic clipping bug —
// overflow:auto/hidden clips ANY descendant that would render outside the
// container's box, including absolutely-positioned popovers, even with a
// high z-index. Anchoring with `position: fixed` off the trigger's real
// screen coordinates (via getBoundingClientRect) sidesteps the container
// entirely, so the menu renders relative to the viewport instead.
function AnchoredMenu({ anchorRef, onClose, align = 'left', width, children }) {
  const [rect, setRect] = useState(null);

  useLayoutEffect(() => {
    if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect());
  }, [anchorRef]);

  if (!rect) return null;

  const margin = 8;
  const spaceBelow = window.innerHeight - rect.bottom - margin;
  const spaceAbove = rect.top - margin;
  // Prefer opening downward; only flip above the trigger if there's
  // genuinely more room up there and not much room below.
  const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
  const maxHeight = (openUp ? spaceAbove : spaceBelow);

  const style = {
    position: 'fixed', zIndex: 400,
    background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
    boxShadow: '0 8px 28px rgba(0,0,0,0.45)', padding: 6,
    maxHeight, overflowY: 'auto',
    width: width || rect.width,
    ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    ...(align === 'right' ? { left: rect.right - (width || rect.width) } : { left: rect.left }),
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 399 }} />
      <div onClick={e => e.stopPropagation()} style={style}>
        {children}
      </div>
    </>
  );
}

function ChannelRow({ channel, active, onClick, onOpenSettings, onOpenInvite, categories, onMoveToCategory }) {
  const [hovered, setHovered] = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const moveBtnRef = useRef(null);
  const showMove = categories && categories.length > 0 && onMoveToCategory;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', margin: '1px 6px' }}
    >
      <button
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0,
          padding: '6px 10px', borderRadius: 6, border: 'none',
          background: active ? 'var(--bg-hover)' : 'transparent',
          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontSize: 13, cursor: 'pointer', textAlign: 'left',
        }}
      >
        {TYPE_ICON[channel.type]}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{channel.name}</span>
      </button>

      {(hovered || moveMenuOpen) && (onOpenInvite || onOpenSettings || showMove) && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0, marginLeft: 2 }}>
          {onOpenInvite && (
            <button
              onClick={e => { e.stopPropagation(); onOpenInvite(channel); }}
              title="Invite people"
              style={{ width: 22, height: 22, border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="16" y1="11" x2="22" y2="11" /></svg>
            </button>
          )}
          {showMove && (
            <button
              ref={moveBtnRef}
              onClick={e => { e.stopPropagation(); setMoveMenuOpen(v => !v); }}
              title="Move to Category"
              style={{ width: 22, height: 22, border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
            </button>
          )}
          {onOpenSettings && (
            <button
              onClick={e => { e.stopPropagation(); onOpenSettings(channel, 'overview'); }}
              title="Edit Channel"
              style={{ width: 22, height: 22, border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            </button>
          )}
        </div>
      )}

      {moveMenuOpen && (
        <AnchoredMenu anchorRef={moveBtnRef} align="right" width={180} onClose={() => setMoveMenuOpen(false)}>
          <div style={{ padding: '4px 10px 6px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Move to Category
          </div>
          <button
            style={{ ...menuItemStyle, color: channel.categoryId == null ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: channel.categoryId == null ? 600 : 400 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}
            onClick={() => { onMoveToCategory(channel.id, null); setMoveMenuOpen(false); }}
          >
            {channel.categoryId == null && '✓ '}No Category
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              style={{ ...menuItemStyle, color: String(channel.categoryId) === String(cat.id) ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: String(channel.categoryId) === String(cat.id) ? 600 : 400 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}
              onClick={() => { onMoveToCategory(channel.id, cat.id); setMoveMenuOpen(false); }}
            >
              {String(channel.categoryId) === String(cat.id) && '✓ '}{cat.name}
            </button>
          ))}
        </AnchoredMenu>
      )}
    </div>
  );
}

const menuItemStyle = {
  display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 5,
  border: 'none', background: 'none', color: 'var(--text-secondary)', fontSize: 12.5,
  cursor: 'pointer', whiteSpace: 'nowrap',
};

// Small anchored popover menu for category rename/delete.
function CategoryMenu({ anchorRef, onRename, onDelete, onCloseMenu }) {
  return (
    <AnchoredMenu anchorRef={anchorRef} align="right" width={168} onClose={onCloseMenu}>
      <button style={menuItemStyle} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'} onClick={() => { onRename(); onCloseMenu(); }}>
        Rename Category
      </button>
      <button style={{ ...menuItemStyle, color: '#e06060' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'} onClick={() => { onDelete(); onCloseMenu(); }}>
        Delete Category
      </button>
    </AnchoredMenu>
  );
}

function CategoryHeader({ category, collapsed, onToggle, onAddChannel, onRenameCategory, onRequestDeleteCategory }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(category.name);
  const kebabRef = useRef(null);

  function commitRename() {
    setEditing(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== category.name) onRenameCategory(category.id, trimmed);
    else setDraftName(category.name);
  }

  if (editing) {
    return (
      <div style={{ padding: '6px 12px 4px' }}>
        <input
          className="auth-input"
          style={{ fontSize: 11.5, padding: '4px 8px', textTransform: 'uppercase', letterSpacing: 0.4 }}
          value={draftName}
          autoFocus
          onChange={e => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') e.target.blur();
            if (e.key === 'Escape') { setDraftName(category.name); setEditing(false); }
          }}
        />
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
      color: 'var(--text-muted)', textTransform: 'uppercase', cursor: 'pointer',
    }}>
      <span onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="9" height="9"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}
        ><polyline points="6 9 12 15 18 9" /></svg>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{category.name}</span>
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        {(onRenameCategory || onRequestDeleteCategory) && (
          <button
            ref={kebabRef}
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            title="Category options"
            style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
          </button>
        )}
        {onAddChannel && (
          <button
            onClick={e => { e.stopPropagation(); onAddChannel(); }}
            title="Create Channel"
            style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      </div>
      {menuOpen && (
        <CategoryMenu
          anchorRef={kebabRef}
          onRename={() => setEditing(true)}
          onDelete={() => onRequestDeleteCategory(category)}
          onCloseMenu={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

// Discord-style server dropdown, opened by clicking the network name at the
// top of the sidebar. Only the items with real backend support are wired up
// (Invite, Create Channel, Create Category, Copy Server ID, Leave Server);
// the rest are shown for parity with the reference but marked unavailable —
// there's no server-settings/boost/events/notification-prefs backend yet.
function ServerMenuItem({ icon, label, onClick, danger, disabled }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        width: '100%', padding: '8px 10px', borderRadius: 4, border: 'none',
        background: hovered && !disabled ? (danger ? '#e06060' : 'var(--accent)') : 'transparent',
        color: disabled ? 'var(--text-muted)' : (hovered && !disabled ? '#fff' : (danger ? '#e06060' : 'var(--text-secondary)')),
        fontSize: 13.5, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span>{label}</span>
      {disabled ? (
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, color: hovered ? '#fff' : 'var(--text-muted)', background: hovered && !disabled ? 'rgba(255,255,255,0.2)' : 'var(--bg-input)', borderRadius: 3, padding: '2px 5px', flexShrink: 0 }}>SOON</span>
      ) : icon}
    </button>
  );
}

function ServerMenuDivider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />;
}

function ServerMenu({ anchorRef, network, onClose, onInvite, onCreateChannel, onCreateCategory, onLeave, onOpenSettings }) {
  const [copied, setCopied] = useState(false);

  function copyId() {
    navigator.clipboard?.writeText(String(network.id)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const iconSize = { width: 14, height: 14 };
  const ICONS = {
    boost: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...iconSize}><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg>,
    invite: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...iconSize}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="16" y1="11" x2="22" y2="11" /></svg>,
    settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...iconSize}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
    plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...iconSize}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
    folderPlus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...iconSize}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>,
    event: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...iconSize}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    apps: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...iconSize}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
    bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...iconSize}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
    shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...iconSize}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    edit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...iconSize}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
    id: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...iconSize}><rect x="2" y="4" width="20" height="16" rx="2" /><circle cx="8" cy="10" r="2" /><line x1="14" y1="9" x2="18" y2="9" /><line x1="14" y1="13" x2="18" y2="13" /><line x1="6" y1="15" x2="10" y2="15" /></svg>,
    leave: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...iconSize}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
  };

  return (
    <AnchoredMenu anchorRef={anchorRef} align="left" width={220} onClose={onClose}>
      <ServerMenuItem icon={ICONS.boost} label="Server Boost" disabled />
      <ServerMenuItem icon={ICONS.invite} label="Invite to Server" onClick={() => { onInvite(); onClose(); }} />
      <ServerMenuItem icon={ICONS.settings} label="Server Settings" onClick={() => { onOpenSettings && onOpenSettings(); onClose(); }} />
      <ServerMenuItem icon={ICONS.plus} label="Create Channel" onClick={() => { onCreateChannel(); onClose(); }} />
      <ServerMenuItem icon={ICONS.folderPlus} label="Create Category" onClick={() => { onCreateCategory(); onClose(); }} />
      <ServerMenuItem icon={ICONS.event} label="Create Event" disabled />
      <ServerMenuItem icon={ICONS.apps} label="App Directory" disabled />
      <ServerMenuDivider />
      <ServerMenuItem icon={ICONS.bell} label="Notification Settings" disabled />
      <ServerMenuItem icon={ICONS.shield} label="Privacy Settings" disabled />
      <ServerMenuDivider />
      <ServerMenuItem icon={ICONS.edit} label="Edit Per-server Profile" disabled />
      <ServerMenuItem icon={ICONS.bell} label="Hide Muted Channels" disabled />
      <ServerMenuDivider />
      <ServerMenuItem icon={ICONS.id} label={copied ? 'Copied!' : 'Copy Server ID'} onClick={copyId} />
      {onLeave && (
        <>
          <ServerMenuDivider />
          <ServerMenuItem icon={ICONS.leave} label="Leave Server" danger onClick={() => { onClose(); onLeave(); }} />
        </>
      )}
    </AnchoredMenu>
  );
}

export default function ChannelSidebar({
  network, channels, activeChannelId, onSelectChannel,
  onCreateChannel, onCreateCategory, onOpenChannelSettings, onOpenInvite,
  onRenameCategory, onRequestDeleteCategory, onMoveToCategory, onLeaveNetwork,
  onOpenNetworkSettings,
  width = 220,
}) {
  const categories = (network.categories || []).slice().sort((a, b) => a.position - b.position);
  const [collapsed, setCollapsed] = useState({});
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const serverBtnRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  const uncategorized = channels.filter(c => !c.categoryId);
  const byCategory = categories.map(cat => ({
    category: cat,
    items: channels.filter(c => c.categoryId === cat.id),
  }));

  function renderRows(items) {
    return items.map(c => (
      <ChannelRow
        key={c.id}
        channel={c}
        active={String(c.id) === String(activeChannelId)}
        onClick={() => onSelectChannel(c)}
        onOpenSettings={onOpenChannelSettings}
        onOpenInvite={onOpenInvite}
        categories={categories}
        onMoveToCategory={onMoveToCategory}
      />
    ));
  }

  const networkBannerUrl = network.bannerUrl
    ? resolveUrl(network.bannerUrl.startsWith('http') ? network.bannerUrl : `${API_BASE}${network.bannerUrl}`)
    : null;

  // The name bar sits pulled up into the bottom of the banner (overlaid, with
  // a gradient fade behind it) until you scroll roughly past the visible
  // banner strip above it, at which point — because it's `position: sticky`
  // — it's already stuck at the top, and we just swap its background from
  // "gradient over the image" to a solid one so it reads as a normal bar.
  const BANNER_HEIGHT = 136;
  const HEADER_OVERLAP = 44;
  const STICK_THRESHOLD = BANNER_HEIGHT - HEADER_OVERLAP;

  function handleScroll(e) {
    if (!networkBannerUrl) return;
    const stuck = e.currentTarget.scrollTop >= STICK_THRESHOLD;
    setScrolled(prev => (prev === stuck ? prev : stuck));
  }

  return (
    <div
      onScroll={handleScroll}
      style={{
        width, flexShrink: 0, background: 'var(--bg-card)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', overflowX: 'hidden',
      }}
    >
      {networkBannerUrl && (
        <img
          src={networkBannerUrl} alt=""
          style={{ width: '100%', height: BANNER_HEIGHT, objectFit: 'cover', display: 'block', flexShrink: 0 }}
        />
      )}

      <div style={{
        position: 'sticky', top: 0, zIndex: 5,
        marginTop: networkBannerUrl ? -HEADER_OVERLAP : 0,
        padding: '10px 12px',
        background: networkBannerUrl && !scrolled
          ? 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.78) 75%)'
          : 'var(--bg-card)',
        boxShadow: scrolled ? '0 1px 0 var(--border)' : 'none',
      }}>
        <button
          ref={serverBtnRef}
          onClick={() => setServerMenuOpen(v => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%',
            padding: '6px 10px', borderRadius: 6, border: 'none',
            fontSize: 14, fontWeight: 600, color: networkBannerUrl && !scrolled ? '#fff' : 'var(--text-primary)',
            background: serverMenuOpen
              ? (networkBannerUrl && !scrolled ? 'rgba(255,255,255,0.12)' : 'var(--bg-hover)')
              : 'transparent',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{network.name}</span>
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"
            style={{
              flexShrink: 0, color: networkBannerUrl && !scrolled ? '#fff' : 'var(--text-muted)',
              opacity: networkBannerUrl && !scrolled ? 0.85 : 1,
              transform: serverMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
            }}
          ><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        {serverMenuOpen && (
          <ServerMenu
            anchorRef={serverBtnRef}
            network={network}
            onClose={() => setServerMenuOpen(false)}
            onInvite={() => onOpenInvite && onOpenInvite(null)}
            onCreateChannel={() => onCreateChannel && onCreateChannel(null)}
            onCreateCategory={onCreateCategory}
            onLeave={onLeaveNetwork}
            onOpenSettings={onOpenNetworkSettings}
          />
        )}
      </div>

      <div style={{ flex: 1, padding: '8px 0' }}>
        {uncategorized.length > 0 && (
          <div style={{ marginBottom: 6 }}>{renderRows(uncategorized)}</div>
        )}

        {byCategory.map(({ category, items }) => (
          <div key={category.id} style={{ marginBottom: 6 }}>
            <CategoryHeader
              category={category}
              collapsed={!!collapsed[category.id]}
              onToggle={() => setCollapsed(prev => ({ ...prev, [category.id]: !prev[category.id] }))}
              onAddChannel={onCreateChannel ? () => onCreateChannel(category.id) : null}
              onRenameCategory={onRenameCategory}
              onRequestDeleteCategory={onRequestDeleteCategory}
            />
            {!collapsed[category.id] && renderRows(items)}
          </div>
        ))}

        {channels.length === 0 && categories.length === 0 && (
          <div style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--text-muted)' }}>
            No channels yet.
          </div>
        )}
      </div>

      {(onCreateChannel || onCreateCategory) && (
        <div style={{ display: 'flex', gap: 6, margin: 10 }}>
          {onCreateChannel && (
            <button
              onClick={() => onCreateChannel(null)}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px dashed var(--border)',
                background: 'none', color: 'var(--text-muted)', fontSize: 12.5, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Channel
            </button>
          )}
          {onCreateCategory && (
            <button
              onClick={onCreateCategory}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px dashed var(--border)',
                background: 'none', color: 'var(--text-muted)', fontSize: 12.5, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Category
            </button>
          )}
        </div>
      )}
    </div>
  );
}
