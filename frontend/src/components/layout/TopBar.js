import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import OmniLogo from '../OmniLogo';
import { useAuth } from '../../context/AuthContext';
import { useRequireAccount } from '../../hooks/useRequireAccount';
import { useSidebar } from '../../context/SidebarContext';
import { API_BASE, notifApi } from '../../services/api';
import MyProfileDrawer from '../MyProfileDrawer';
import NotificationPanel from '../NotificationPanel';

function DefaultAvatar({ size = 36, name = '' }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

const BellIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const SearchIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const ClearIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const PlusIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const MenuIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;

/* ── Shared icon-button style ─────────────────────────────────────────────── */
const iconBtnStyle = {
  position: 'relative', background: 'none', border: '1px solid var(--border-input)',
  borderRadius: 8, width: 36, height: 36,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0,
  transition: 'border-color 0.15s, color 0.15s, background 0.15s',
};

export default function TopBar() {
  const { user }     = useAuth();
  const requireAccount = useRequireAccount();
  const { collapsed, hidden, overlayOpen, toggle, toggleOverlay } = useSidebar();
  const handleHamburger = hidden ? toggleOverlay : toggle;
  const { pathname } = useLocation();
  const navigate     = useNavigate();
  const [searchParams] = useSearchParams();
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [searchVal,    setSearchVal]    = useState(searchParams.get('q') || '');
  const [searchFocus,  setSearchFocus]  = useState(false);

  useEffect(() => {
    if (pathname === '/search') setSearchVal(searchParams.get('q') || '');
    else setSearchVal('');
  }, [pathname]); // intentionally exclude searchParams

  useEffect(() => {
    if (!user?.id) return;
    const fetch = () => notifApi.unreadCount(user.id).then(r => setUnreadCount(r.count)).catch(() => {});
    fetch();
    const t = setInterval(fetch, 30000);
    return () => clearInterval(t);
  }, [user?.id]);

  const isSettings = pathname === '/settings';
  const isMessages = pathname === '/messages';
  const isHome     = pathname === '/';
  const isMedia    = pathname === '/media';
  const showCreate = isHome || isMedia;

  const picSrc = user?.profilePicture
    ? (user.profilePicture.startsWith('http') ? user.profilePicture : `${API_BASE}${user.profilePicture}`)
    : null;

  function goSearch(e) {
    e.preventDefault();
    const q = searchVal.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}&tab=Posts`);
  }

  return (
    <>
      <style>{`
        .topbar-root {
          position: fixed; top: 0; left: 0; right: 0; z-index: 200;
          height: 58px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          padding: 0 16px;
          box-sizing: border-box;
          gap: 8px;
          background: var(--bg-topbar);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
        }
        .topbar-icon-btn { position: relative; background: none; border: 1px solid var(--border-input); border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-muted); flex-shrink: 0; transition: border-color 0.15s, color 0.15s, background 0.15s; }
        .topbar-icon-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-glow); }
        .topbar-search-wrap { display: flex; width: 480px; max-width: 480px; }
        .topbar-search-box {
          display: flex; align-items: center;
          background: var(--bg-input); border: 1px solid var(--border-input);
          border-radius: 9999px; padding: 0 14px; height: 36px; width: 100%;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .topbar-search-box.focused { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
        .topbar-search-input { background: none; border: none; outline: none; color: var(--text-primary); font-size: 14px; flex: 1; margin-left: 10px; min-width: 0; }
        .topbar-search-input::placeholder { color: var(--text-muted); }
        .topbar-create-btn {
          display: flex; align-items: center; gap: 6px;
          background: var(--accent); border: none; border-radius: 9999px;
          padding: 8px 16px; color: #fff; font-size: 13px; font-weight: 700;
          cursor: pointer; transition: opacity 0.15s, transform 0.1s; flex-shrink: 0;
          letter-spacing: -0.01em;
        }
        .topbar-create-btn:hover  { opacity: 0.88; }
        .topbar-create-btn:active { transform: scale(0.97); }
        .topbar-avatar-btn {
          background: none; border: 1px solid var(--border-input); border-radius: 50%;
          padding: 0; cursor: pointer; width: 36px; height: 36px; overflow: hidden;
          transition: border-color 0.15s; flex-shrink: 0; display: flex;
          align-items: center; justify-content: center;
        }
        .topbar-avatar-btn:hover { border-color: var(--accent); }
        .topbar-notif-badge {
          position: absolute; top: -5px; right: -5px;
          background: #ef4444; color: #fff; font-size: 10px; font-weight: 700;
          border-radius: 9999px; min-width: 17px; height: 17px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 4px; line-height: 1;
          border: 2px solid var(--bg-topbar);
        }
        @media (max-width: 768px) {
          .topbar-hamburger-wrap { display: none !important; }
          .topbar-create-btn    { display: none !important; }
          .topbar-avatar-btn    { display: none !important; }
          .topbar-search-wrap   { width: 100% !important; max-width: 100% !important; }
          .topbar-search-box    { width: 100% !important; box-sizing: border-box; }
          .topbar-left  { flex: 0 0 auto !important; }
          .topbar-right { flex: 0 0 auto !important; }
          .notif-panel  { width: 100vw !important; left: 0 !important; right: 0 !important; border-left: none !important; }
        }
      `}</style>

      <div className="topbar-root">
        {/* Left: hamburger + logo */}
        <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="topbar-hamburger-wrap">
            <button
              className="topbar-icon-btn"
              onClick={handleHamburger}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <MenuIcon />
            </button>
          </div>
          <OmniLogo size={20} onClick={() => navigate('/')} />
        </div>

        {/* Center: search */}
        {!isSettings && !isMessages ? (
          <form onSubmit={goSearch} className="topbar-search-wrap">
            <div className={`topbar-search-box${searchFocus ? ' focused' : ''}`}>
              <SearchIcon style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                className="topbar-search-input"
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                onFocus={() => setSearchFocus(true)}
                onBlur={() => setSearchFocus(false)}
                placeholder="Search Omni…"
              />
              {searchVal && (
                <button
                  type="button"
                  onClick={() => setSearchVal('')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                >
                  <ClearIcon />
                </button>
              )}
            </div>
          </form>
        ) : (
          <div />
        )}

        {/* Right: Create + Bell + Avatar */}
        <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          {showCreate && (
            <button
              className="topbar-create-btn"
              onClick={() => { if (!requireAccount('create a post')) return; navigate(isMedia ? '/create/media' : '/create'); }}
            >
              <PlusIcon />
              Create
            </button>
          )}

          {!isSettings && user && (
            <button
              className="topbar-icon-btn"
              onClick={() => setNotifOpen(o => !o)}
              title="Notifications"
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="topbar-notif-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {!isSettings && user && (
            <button
              className="topbar-avatar-btn"
              onClick={() => setProfileOpen(true)}
              title="My profile"
            >
              {picSrc
                ? <img src={picSrc} alt="me" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <DefaultAvatar size={34} name={user?.displayName || user?.username} />
              }
            </button>
          )}

          {!isSettings && !user && (
            <button
              className="topbar-create-btn"
              style={{ background: 'none', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
              onClick={() => navigate(`/accounts/login?next=${encodeURIComponent(pathname)}`)}
            >
              Log in
            </button>
          )}
        </div>
      </div>

      {/* Accent signal line */}
      <div className="omni-signal-line" />
      <div style={{ height: 58, flexShrink: 0 }} />

      {profileOpen && <MyProfileDrawer onClose={() => setProfileOpen(false)} />}
      {notifOpen && (
        <NotificationPanel
          userId={user?.id}
          onClose={() => { setNotifOpen(false); setUnreadCount(0); }}
          onReadCountChange={setUnreadCount}
        />
      )}
    </>
  );
}
