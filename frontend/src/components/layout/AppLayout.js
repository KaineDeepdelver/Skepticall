import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import TopBar from './TopBar';
import { useSidebar } from '../../context/SidebarContext';
import { useAuth } from '../../context/AuthContext';
import { useRequireAccount } from '../../hooks/useRequireAccount';
import { api } from '../../services/api';
import LiveToast from '../LiveToast';
import CallScreen from '../CallScreen';
import GuestBlockedListener from '../GuestBlockedListener';
import { Toaster } from 'react-hot-toast';

const MsgIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const SetIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;

export default function AppLayout() {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const { collapsed, hidden, overlayOpen, width, setWidth } = useSidebar();
  const { user } = useAuth();
  const requireAccount = useRequireAccount();

  // Conversations still needed for LiveToast
  const [conversations, setConversations] = React.useState([]);
  React.useEffect(() => {
    if (!user?.id) return;
    api.getConversations(user.id).then(setConversations).catch(() => {});
  }, [user?.id]);

  const nav = [
    { to: '/messages', label: 'Messages', Icon: MsgIcon },
    { to: '/settings', label: 'Settings', Icon: SetIcon },
  ];

  const mobileNav = [
    { to: '/messages', label: 'Messages', Icon: MsgIcon },
    { to: '/settings', label: 'Settings', Icon: SetIcon },
  ];

  const FULL = width;
  const MINI = 72;
  const isMini     = collapsed;
  const sidebarW   = isMini ? MINI : FULL;
  const overlayMode = hidden;

  // Drag-to-resize — only active when the sidebar is expanded on desktop
  // (not mini/collapsed, not the mobile/video-page overlay mode).
  const [isResizing, setIsResizing] = React.useState(false);
  const resizable = !isMini && !overlayMode;

  React.useEffect(() => {
    if (!isResizing) return;
    function onMouseMove(e) { setWidth(e.clientX); }
    function onMouseUp()    { setIsResizing(false); }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, setWidth]);

  return (
    <>
        <div className="app-layout" style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
          {/* Desktop sidebar */}
          <aside className="sidebar" style={{
            boxSizing: 'border-box',
            height: '100vh',
            flexShrink: 0,
            overflow: 'hidden',
            padding: '70px 8px 12px',
            position: overlayMode ? 'fixed' : 'relative',
            ...(overlayMode ? {
              top: 0, left: 0, zIndex: 100,
              width: isMini ? MINI : FULL,
              minWidth: isMini ? MINI : FULL,
              transform: overlayOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.3s ease',
            } : {
              width: sidebarW,
              minWidth: sidebarW,
              transition: isResizing ? 'none' : 'width 0.3s ease, min-width 0.3s ease',
            }),
          }}>
            {resizable && (
              <div
                onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
                className="sidebar-resize-handle"
                style={{
                  position: 'absolute', top: 0, right: -3, bottom: 0, width: 6,
                  cursor: 'col-resize', zIndex: 10,
                }}
              />
            )}
            <nav style={{ display:'flex', flexDirection:'column', gap:4, width: isMini ? MINI-16 : FULL-16 }}>
              {nav.map(({ to, label, Icon }) => (
                <button
                  key={to}
                  className={`nav-link${pathname === to ? ' active' : ''}`}
                  onClick={() => {
                    if (to === '/messages' && !user) { requireAccount('open messages'); return; }
                    navigate(to, to === '/settings' ? { state: { tab: 'profile' } } : undefined);
                  }}
                  title={isMini ? label : ''}
                  style={{ justifyContent: isMini ? 'center' : 'flex-start', padding: isMini ? '11px 0' : '11px 14px' }}
                >
                  <Icon />
                  <span style={{ opacity: isMini ? 0 : 1, width: isMini ? 0 : 'auto', overflow:'hidden', transition:'opacity 0.2s, width 0.3s', whiteSpace:'nowrap' }}>{label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden', height:'100vh' }}>
            <TopBar />
            <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
              <Outlet />
            </div>
          </div>

          {/* Mobile bottom nav */}
          <nav className="mobile-bottom-nav">
            {mobileNav.map(({ to, label, Icon }) => {
              const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
              return (
                <button
                  key={to}
                  className={`mobile-nav-btn${active ? ' active' : ''}`}
                  onClick={() => {
                    if (to === '/messages' && !user) { requireAccount('open messages'); return; }
                    navigate(to, to === '/settings' ? { state: { tab: 'profile' } } : undefined);
                  }}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="mobile-nav-icon"><Icon /></span>
                  <span className="mobile-nav-label">{label}</span>
                </button>
              );
            })}
          </nav>

        </div>

        <LiveToast userId={user?.id} conversations={conversations} />
        <GuestBlockedListener />

        {/*
          CallNotification renders the floating card on all pages except /messages.
          No props needed — it reads everything from CallContext via useCall().
          The actual <audio> element is inside CallProvider (always mounted).
        */}
        <CallScreen />

        <Toaster
          position="top-center"
          toastOptions={{ style: { background:'transparent', boxShadow:'none', padding:0 } }}
        />
    </>
  );
}
