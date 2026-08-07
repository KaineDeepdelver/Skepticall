import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, adminApi } from '../services/api';
import { VideoView } from './Media';
import TopBar from '../components/layout/TopBar';
import ConfirmModal from '../components/ConfirmModal';

/**
 * Standalone video-watch page. Deliberately mounted OUTSIDE AppLayout in
 * App.js (its own top-level <Route>, not nested under the AppLayout parent
 * route) so it doesn't get the nav sidebar — it does, however, use the same
 * global TopBar as everywhere else for consistency (search, notifications,
 * profile). TopBar accepts a `transparent` prop so it can go fully see-
 * through during ambient/reactive mode and let the ambilight glow bleed all
 * the way to the very top of the screen, and an `onBack` prop that swaps its
 * hamburger (there's no sidebar here to toggle) for a back button instead.
 * `reactive` is owned right here and handed down as a normal prop to both
 * TopBar and VideoView.
 */
export default function Watch() {
  const { id }     = useParams();
  const location   = useLocation();
  const navigate   = useNavigate();
  const { user }   = useAuth();

  const passedItem     = location.state?.item;
  const passedAllItems = location.state?.allItems;

  const [item,     setItem]     = useState(passedItem && String(passedItem.id) === id ? passedItem : null);
  const [allItems, setAllItems] = useState(passedAllItems || []);
  const [loading,  setLoading]  = useState(!passedItem);
  const [reactive, setReactive] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState('');

  // Fallback fetch — covers page refresh / direct link / shared URL, where
  // there's no router state to read the item from.
  useEffect(() => {
    if (item && String(item.id) === id) return;
    let cancelled = false;
    setLoading(true);
    api.getMedia(0, user?.id).then(page => {
      if (cancelled) return;
      const list = page.content || page || [];
      setAllItems(list);
      setItem(list.find(v => String(v.id) === id) || null);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  function watchOther(newItem) {
    navigate(`/media/watch/${newItem.id}`, { state: { item: newItem, allItems } });
  }

  function handleVoteExternal(updated) {
    setAllItems(prev => prev.map(v => v.id === updated.id ? updated : v));
  }

  function handleDelete(mediaId)      { setDeleteTarget({ mediaId, admin: false }); }
  function handleAdminDelete(mediaId) { setDeleteTarget({ mediaId, admin: true }); }

  async function confirmDeleteMedia() {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteError('');
    try {
      if (deleteTarget.admin) await adminApi.deleteMedia(deleteTarget.mediaId);
      else await api.deleteMedia(deleteTarget.mediaId);
      navigate('/media');
    } catch (e) {
      setDeleteError(e.message || 'Failed to delete video.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
        Loading…
      </div>
    );
  }

  if (!item) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
        <div>Video not found.</div>
        <button onClick={() => navigate('/media')} style={{ background: 'var(--signal)', border: 'none', borderRadius: 4, padding: '8px 16px', color: 'var(--accent-text)', cursor: 'pointer' }}>
          Back to Media
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: reactive ? '#060708' : 'var(--bg-primary)',
      transition: 'background 0.5s ease' }}>
      <TopBar transparent={reactive} onBack={() => navigate('/media')} />
      {/* overflow:visible so the topGlowRef fixed video can render above this container */}
      <div style={{ flex: 1, overflow: 'visible', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <VideoView
          key={item.id}
          item={item}
          userId={user?.id}
          isAdmin={!!user?.admin}
          onBack={() => navigate('/media')}
          onVoteExternal={handleVoteExternal}
          onDelete={handleDelete}
          onAdminDelete={handleAdminDelete}
          allItems={allItems}
          onSelectItem={watchOther}
          externalReactiveMode={reactive}
          onReactiveModeChange={setReactive}
        />
      </div>

      {deleteTarget && (
        <ConfirmModal
          title={deleteTarget.admin ? 'Delete video as admin?' : 'Delete this video?'}
          message={deleteTarget.admin
            ? "This bypasses ownership and can't be undone."
            : "This permanently deletes the video and can't be undone."}
          confirmLabel="Delete"
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteMedia}
          confirming={deleting}
          error={deleteError}
        />
      )}
    </div>
  );
}
