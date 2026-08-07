import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { networkApi } from '../services/api';
import NetworkRail from '../components/networks/NetworkRail';
import ChannelSidebar from '../components/networks/ChannelSidebar';
import ChannelView from '../components/networks/ChannelView';
import { CreateOrJoinNetworkModal, CreateChannelModal, CreateCategoryModal } from '../components/networks/NetworkModals';
import ChannelSettingsModal from '../components/networks/ChannelSettingsModal';
import InviteFriendsModal from '../components/networks/InviteFriendsModal';
import NetworkSettingsModal from '../components/networks/NetworkSettingsModal';
import ConfirmModal from '../components/ConfirmModal';

/**
 * Top-level Networks page — the Discord-style section: a rail of joined
 * networks, a channel sidebar for whichever one's active, and the chat
 * panel for whichever channel's active. Lives inside AppLayout (nav
 * sidebar + TopBar stay put; this only owns the content area).
 *
 * Role/permission management UI (creating custom roles, assigning them,
 * editing the permission bitmask) isn't built yet — the backend supports
 * all of it, this page just doesn't expose it. Worth a follow-up pass.
 */
/**
 * Thin draggable divider between the channel sidebar and the chat panel.
 * The visible bar is 1px so it doesn't intrude on the layout at rest, but
 * the hit area (via padding + a wider inner strip) is much more forgiving
 * to grab, and it lights up on hover so it reads as interactive.
 */
function ResizeHandle({ onMouseDown }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Drag to resize"
      style={{
        width: 6, flexShrink: 0, cursor: 'col-resize', position: 'relative',
        display: 'flex', justifyContent: 'center',
      }}
    >
      <div style={{
        width: hovered ? 4 : 2, height: '100%',
        background: hovered ? 'var(--accent)' : 'var(--border)',
        transition: 'background-color 0.15s ease, width 0.15s ease',
      }} />
    </div>
  );
}

export default function NetworksPage() {
  const { networkId: networkIdParam } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [networks, setNetworks]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [channels, setChannels]   = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [showAddNetwork, setShowAddNetwork] = useState(false);
  const [channelModal, setChannelModal] = useState(null); // { categoryId } | null
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState(null); // { channel, tab } | null
  const [inviteTarget, setInviteTarget] = useState(null); // channel | null
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState(null); // category | null
  const [deletingCategory, setDeletingCategory] = useState(false);
  const [deleteCategoryError, setDeleteCategoryError] = useState('');
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [networkSettingsOpen, setNetworkSettingsOpen] = useState(false);
  const [leavingNetwork, setLeavingNetwork] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [error, setError] = useState('');

  // Resizable channel sidebar. Clamped between MIN/MAX so it can't be
  // dragged down to nothing or stretched over the chat panel. Persisted
  // per-browser so it sticks across reloads.
  const SIDEBAR_MIN = 180;
  const SIDEBAR_MAX = 400;
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem('omni-channel-sidebar-width'));
    return saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX ? saved : 220;
  });
  const resizing = useRef(false);
  const resizeStart = useRef({ x: 0, width: 220 });

  function handleResizeStart(e) {
    resizing.current = true;
    resizeStart.current = { x: e.clientX, width: sidebarWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
  }

  function handleResizeMove(e) {
    if (!resizing.current) return;
    const delta = e.clientX - resizeStart.current.x;
    const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, resizeStart.current.width + delta));
    setSidebarWidth(next);
  }

  function handleResizeEnd() {
    resizing.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeEnd);
    setSidebarWidth(w => {
      localStorage.setItem('omni-channel-sidebar-width', String(w));
      return w;
    });
  }

  // Clean up listeners if the component unmounts mid-drag.
  useEffect(() => () => {
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeEnd);
  }, []);

  const activeNetwork = networks.find(n => String(n.id) === String(networkIdParam)) || null;

  const loadNetworks = useCallback(async () => {
    try {
      const list = await networkApi.mine();
      setNetworks(list);
      return list;
    } catch (e) {
      setError(e.message || 'Failed to load networks.');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load — and if there's no :networkId in the URL yet, jump to the
  // first joined network so the page never looks empty on a bare /networks visit.
  useEffect(() => {
    loadNetworks().then(list => {
      if (!networkIdParam && list.length > 0) {
        navigate(`/networks/${list[0].id}`, { replace: true });
      }
    });
  }, [loadNetworks]);

  // Load channels whenever the active network changes.
  useEffect(() => {
    setChannels([]); setActiveChannel(null);
    if (!activeNetwork) return;
    networkApi.getChannels(activeNetwork.id)
      .then(list => {
        setChannels(list);
        if (list.length > 0) setActiveChannel(list[0]);
      })
      .catch(e => setError(e.message || 'Failed to load channels.'));
  }, [activeNetwork?.id]);

  async function handleCreateChannel(name, type) {
    const categoryId = channelModal?.categoryId ?? null;
    const channel = await networkApi.createChannel(activeNetwork.id, name, type, categoryId);
    setChannels(prev => [...prev, channel]);
    setActiveChannel(channel);
    return channel;
  }

  async function handleCreateCategory(name) {
    const category = await networkApi.createCategory(activeNetwork.id, name);
    setNetworks(prev => prev.map(n => n.id === activeNetwork.id
      ? { ...n, categories: [...(n.categories || []), category] }
      : n));
    return category;
  }

  async function handleRenameCategory(categoryId, name) {
    try {
      const updated = await networkApi.renameCategory(activeNetwork.id, categoryId, name);
      setNetworks(prev => prev.map(n => n.id === activeNetwork.id
        ? { ...n, categories: (n.categories || []).map(c => c.id === updated.id ? updated : c) }
        : n));
    } catch (e) {
      setError(e.message || 'Failed to rename category.');
    }
  }

  async function handleConfirmDeleteCategory() {
    if (!deleteCategoryTarget) return;
    setDeletingCategory(true); setDeleteCategoryError('');
    try {
      await networkApi.deleteCategory(activeNetwork.id, deleteCategoryTarget.id);
      setNetworks(prev => prev.map(n => n.id === activeNetwork.id
        ? { ...n, categories: (n.categories || []).filter(c => c.id !== deleteCategoryTarget.id) }
        : n));
      // Backend uncategorizes any channels that were under this category —
      // mirror that locally so the sidebar doesn't show stale groupings.
      setChannels(prev => prev.map(c => c.categoryId === deleteCategoryTarget.id ? { ...c, categoryId: null } : c));
      setDeleteCategoryTarget(null);
    } catch (e) {
      setDeleteCategoryError(e.message || 'Failed to delete category.');
    } finally {
      setDeletingCategory(false);
    }
  }

  async function handleMoveToCategory(channelId, categoryId) {
    try {
      const updated = await networkApi.moveChannelToCategory(activeNetwork.id, channelId, categoryId);
      setChannels(prev => prev.map(c => c.id === updated.id ? updated : c));
      if (activeChannel?.id === updated.id) setActiveChannel(updated);
    } catch (e) {
      setError(e.message || 'Failed to move channel.');
    }
  }

  async function handleConfirmLeaveNetwork() {
    if (!activeNetwork) return;
    setLeavingNetwork(true); setLeaveError('');
    try {
      await networkApi.leave(activeNetwork.id);
      const remaining = networks.filter(n => n.id !== activeNetwork.id);
      setNetworks(remaining);
      setConfirmingLeave(false);
      navigate(remaining.length > 0 ? `/networks/${remaining[0].id}` : '/networks', { replace: true });
    } catch (e) {
      setLeaveError(e.message || 'Failed to leave server.');
    } finally {
      setLeavingNetwork(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>;
  }

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, height: '100%' }}>
      <NetworkRail
        networks={networks}
        activeNetworkId={activeNetwork?.id}
        onSelect={n => navigate(`/networks/${n.id}`)}
        onAddClick={() => setShowAddNetwork(true)}
      />

      {!activeNetwork ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
          <div>You're not in any networks yet.</div>
          <button
            onClick={() => setShowAddNetwork(true)}
            style={{ background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontSize: 13.5 }}
          >
            Create or join one
          </button>
        </div>
      ) : (
        <>
          <ChannelSidebar
            network={activeNetwork}
            channels={channels}
            activeChannelId={activeChannel?.id}
            onSelectChannel={setActiveChannel}
            onCreateChannel={categoryId => setChannelModal({ categoryId })}
            onCreateCategory={() => setShowCreateCategory(true)}
            onOpenChannelSettings={(channel, tab) => setSettingsTarget({ channel, tab })}
            onOpenInvite={channel => setInviteTarget(channel)}
            onRenameCategory={handleRenameCategory}
            onRequestDeleteCategory={category => setDeleteCategoryTarget(category)}
            onMoveToCategory={handleMoveToCategory}
            onLeaveNetwork={() => setConfirmingLeave(true)}
            onOpenNetworkSettings={() => setNetworkSettingsOpen(true)}
            width={sidebarWidth}
          />
          <ResizeHandle onMouseDown={handleResizeStart} />
          <ChannelView
            networkId={activeNetwork.id}
            channel={activeChannel}
            currentUserId={user?.id}
          />
        </>
      )}

      {error && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, padding: '10px 16px', borderRadius: 8, fontSize: 13, background: 'rgba(224,96,96,0.15)', color: '#e06060', border: '1px solid rgba(224,96,96,0.3)' }}>
          {error}
        </div>
      )}

      {showAddNetwork && (
        <CreateOrJoinNetworkModal
          onClose={() => setShowAddNetwork(false)}
          onCreated={network => { setShowAddNetwork(false); setNetworks(prev => [...prev, network]); navigate(`/networks/${network.id}`); }}
          onJoined={network => { setShowAddNetwork(false); loadNetworks(); navigate(`/networks/${network.id}`); }}
        />
      )}

      {channelModal && (
        <CreateChannelModal
          categoryName={
            channelModal.categoryId
              ? (activeNetwork.categories || []).find(c => c.id === channelModal.categoryId)?.name
              : null
          }
          onClose={() => setChannelModal(null)}
          onCreate={handleCreateChannel}
          onCreated={() => setChannelModal(null)}
        />
      )}

      {showCreateCategory && (
        <CreateCategoryModal
          onClose={() => setShowCreateCategory(false)}
          onCreate={handleCreateCategory}
          onCreated={() => setShowCreateCategory(false)}
        />
      )}

      {settingsTarget && (
        <ChannelSettingsModal
          network={activeNetwork}
          channel={settingsTarget.channel}
          initialTab={settingsTarget.tab}
          onClose={() => setSettingsTarget(null)}
          onChannelUpdated={updated => {
            setChannels(prev => prev.map(c => c.id === updated.id ? updated : c));
            if (activeChannel?.id === updated.id) setActiveChannel(updated);
            setSettingsTarget(prev => prev && { ...prev, channel: updated });
          }}
          onChannelDeleted={deletedId => {
            setChannels(prev => prev.filter(c => c.id !== deletedId));
            if (activeChannel?.id === deletedId) setActiveChannel(null);
            setSettingsTarget(null);
          }}
        />
      )}
      {inviteTarget && (
        <InviteFriendsModal
          network={activeNetwork}
          channel={inviteTarget}
          onClose={() => setInviteTarget(null)}
        />
      )}
      {deleteCategoryTarget && (
        <ConfirmModal
          title="Delete Category"
          message={`Delete "${deleteCategoryTarget.name}"? Channels inside it won't be deleted — they'll just move back to uncategorized.`}
          confirmLabel="Delete Category"
          onClose={() => { setDeleteCategoryTarget(null); setDeleteCategoryError(''); }}
          onConfirm={handleConfirmDeleteCategory}
          confirming={deletingCategory}
          error={deleteCategoryError}
        />
      )}
      {confirmingLeave && activeNetwork && (
        <ConfirmModal
          title="Leave Server"
          message={`Are you sure you want to leave "${activeNetwork.name}"? You'll need a new invite to rejoin.`}
          confirmLabel="Leave Server"
          onClose={() => { setConfirmingLeave(false); setLeaveError(''); }}
          onConfirm={handleConfirmLeaveNetwork}
          confirming={leavingNetwork}
          error={leaveError}
        />
      )}
      {networkSettingsOpen && activeNetwork && (
        <NetworkSettingsModal
          network={activeNetwork}
          onClose={() => setNetworkSettingsOpen(false)}
          onNetworkUpdated={updated => setNetworks(prev => prev.map(n => n.id === updated.id ? updated : n))}
        />
      )}
    </div>
  );
}
