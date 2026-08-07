import React, { useState } from 'react';
import { networkApi } from '../../services/api';

const CLOSE_BTN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// Three-state permission toggle: deny (x) / inherit (slash) / allow (check).
// Matches Discord's own control. Local state only for now — see the note
// in each tab below about what's actually wired to the backend.
function PermissionToggle({ value, onChange }) {
  const opts = ['deny', 'inherit', 'allow'];
  const icons = {
    deny:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
    inherit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"><line x1="6" y1="18" x2="18" y2="6" /></svg>,
    allow:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12" /></svg>,
  };
  const activeColor = { deny: '#e06060', inherit: 'var(--text-secondary)', allow: '#3ba55d' };

  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      {opts.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          title={opt}
          style={{
            width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: value === opt ? 'var(--bg-elevated)' : 'var(--bg-input)',
            color: value === opt ? activeColor[opt] : 'var(--text-muted)',
            boxShadow: value === opt ? `inset 0 0 0 1.5px ${activeColor[opt]}` : 'none',
          }}
        >
          {icons[opt]}
        </button>
      ))}
    </div>
  );
}

function PermRow({ label, description, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        {description && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>{description}</div>}
      </div>
      <PermissionToggle value={value} onChange={onChange} />
    </div>
  );
}

const TEXT_PERMISSION_GROUPS = [
  {
    title: 'General Channel Permissions',
    perms: [
      ['VIEW_CHANNEL', 'View Channel', 'Allows members to view this channel by default. Disabling this for @everyone will make this channel private.'],
      ['MANAGE_CHANNEL', 'Manage Channel', "Allows members to change this channel's name, topic, and settings. They can also delete the channel."],
      ['MANAGE_PERMISSIONS', 'Manage Permissions', "Allows members to change this channel's permissions."],
    ],
  },
  {
    title: 'Membership Permissions',
    perms: [
      ['CREATE_INVITE', 'Create Invite', 'Allows members to invite new people to this network via a direct invite link to this channel.'],
    ],
  },
  {
    title: 'Text Channel Permissions',
    perms: [
      ['SEND_MESSAGES', 'Send Messages', 'Allows members to send messages in this channel.'],
      ['EMBED_LINKS', 'Embed Links', 'Allows links that members share to show embedded content in this channel.'],
      ['ATTACH_FILES', 'Attach Files', 'Allows members to upload files or media in this channel.'],
      ['ADD_REACTIONS', 'Add Reactions', 'Allows members to add new emoji reactions to a message in this channel.'],
      ['MENTION_EVERYONE', 'Mention @everyone and All Roles', 'Allows members to use @everyone in this channel, and @mention all roles even if the role itself disallows it.'],
      ['MANAGE_MESSAGES', 'Manage Messages', 'Allows members to delete messages by other members in this channel.'],
      ['READ_MESSAGE_HISTORY', 'Read Message History', 'Allows members to read previous messages sent in this channel.'],
    ],
  },
];

const VOICE_PERMISSION_GROUPS = [
  {
    title: 'General Channel Permissions',
    perms: [
      ['VIEW_CHANNEL', 'View Channel', 'Allows members to view this channel by default. Disabling this and Connect for @everyone will make this channel private.'],
      ['MANAGE_CHANNEL', 'Manage Channel', "Allows members to change this channel's name and settings. They can also delete the channel."],
      ['MANAGE_PERMISSIONS', 'Manage Permissions', "Allows members to change this channel's permissions."],
    ],
  },
  {
    title: 'Membership Permissions',
    perms: [
      ['CREATE_INVITE', 'Create Invite', 'Allows members to invite new people to this network via a direct invite link to this channel.'],
    ],
  },
  {
    title: 'Voice Channel Permissions',
    perms: [
      ['CONNECT', 'Connect', 'Allows members to join this voice channel and hear others.'],
      ['SPEAK', 'Speak', 'Allows members to talk in this voice channel.'],
      ['VIDEO', 'Video', 'Allows members to share their video or screen in this voice channel.'],
      ['MUTE_MEMBERS', 'Mute Members', 'Allows members to mute other members in this voice channel for everyone.'],
      ['DEAFEN_MEMBERS', 'Deafen Members', "Allows members to deafen other members in this voice channel, which means they won't be able to speak or hear others."],
      ['MOVE_MEMBERS', 'Move Members', 'Allows members to disconnect other members from this channel, or move them to other channels.'],
    ],
  },
];

function buildDefaultOverrides(groups) {
  const state = {};
  groups.forEach(g => g.perms.forEach(([key]) => { state[key] = 'inherit'; }));
  return state;
}

function OverviewTab({ networkId, channel, onChannelUpdated }) {
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState('');
  const [slowmode, setSlowmode] = useState('off');
  const [visibility, setVisibility] = useState('default');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty = name.trim() !== channel.name;

  async function saveName() {
    if (!dirty || !name.trim()) return;
    setSaving(true); setError('');
    try {
      const updated = await networkApi.renameChannel(networkId, channel.id, name.trim());
      onChannelUpdated(updated);
    } catch (e) {
      setError(e.message || 'Failed to rename channel.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 20px' }}>Overview</h2>

      <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Channel Name</label>
      <input
        className="auth-input" style={{ marginTop: 8, marginBottom: 20 }}
        value={name} onChange={e => setName(e.target.value)} onBlur={saveName}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
      />

      <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Channel Topic</label>
      <textarea
        className="auth-input" rows={3} placeholder="Let everyone know how to use this channel!"
        style={{ marginTop: 8, marginBottom: 6, resize: 'vertical', fontFamily: 'inherit' }}
        value={topic} onChange={e => setTopic(e.target.value.slice(0, 1024))}
      />
      <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>{topic.length}/1024</div>

      {channel.type !== 'VOICE' && (
        <>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Slowmode</label>
          <select className="auth-input" style={{ marginTop: 8, marginBottom: 6 }} value={slowmode} onChange={e => setSlowmode(e.target.value)}>
            <option value="off">Off</option>
            <option value="5">5 seconds</option>
            <option value="10">10 seconds</option>
            <option value="30">30 seconds</option>
            <option value="60">1 minute</option>
            <option value="300">5 minutes</option>
          </select>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
            Members will be restricted to sending one message per this interval, unless they have the Bypass Slowmode permission.
          </div>

          <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Content Visibility</label>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              ['default', 'Default', 'Channel content is always visible.'],
              ['spoiler', 'Spoiler Channel', 'Mark this channel as containing spoilers, so sensitive discussions are hidden until members choose to view them.'],
              ['age', 'Age-Restricted Channel', 'Members will need to confirm they are of legal age to view content in this channel.'],
            ].map(([val, label, desc]) => (
              <label key={val} style={{ display: 'flex', gap: 10, cursor: 'pointer' }}>
                <input type="radio" name="visibility" checked={visibility === val} onChange={() => setVisibility(val)} style={{ marginTop: 3 }} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
                </div>
              </label>
            ))}
          </div>
        </>
      )}

      {error && <div style={{ marginTop: 16, padding: '9px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(224,96,96,0.12)', color: '#e06060', border: '1px solid rgba(224,96,96,0.3)' }}>{error}</div>}
      {saving && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>Saving…</div>}

      <div style={{ marginTop: 24, padding: '10px 12px', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-input)' }}>
        Channel name saves for real. Topic, slowmode, and content visibility are a visual preview — the backend doesn't store these yet.
      </div>
    </div>
  );
}

function PermissionsTab({ network, channel }) {
  const roles = network.roles && network.roles.length > 0 ? network.roles : [{ id: 'everyone', name: '@everyone' }];
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0].id);
  const groups = channel.type === 'VOICE' ? VOICE_PERMISSION_GROUPS : TEXT_PERMISSION_GROUPS;
  const [overridesByRole, setOverridesByRole] = useState(() => {
    const init = {};
    roles.forEach(r => { init[r.id] = buildDefaultOverrides(groups); });
    return init;
  });

  const current = overridesByRole[selectedRoleId] || buildDefaultOverrides(groups);

  function setPerm(key, value) {
    setOverridesByRole(prev => ({ ...prev, [selectedRoleId]: { ...(prev[selectedRoleId] || buildDefaultOverrides(groups)), [key]: value } }));
  }

  return (
    <div style={{ display: 'flex', gap: 32 }}>
      <div style={{ width: 200, flexShrink: 0 }}>
        <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 6px' }}>Channel Permissions</h2>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>Use permissions to customize who can do what in this channel.</div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Roles/Members</div>
        {roles.map(r => (
          <button
            key={r.id}
            onClick={() => setSelectedRoleId(r.id)}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', marginBottom: 2, borderRadius: 6, border: 'none', cursor: 'pointer',
              background: selectedRoleId === r.id ? 'var(--bg-hover)' : 'transparent',
              color: selectedRoleId === r.id ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13,
            }}
          >{r.name}</button>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {groups.map(group => (
          <div key={group.title} style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 15, color: 'var(--text-primary)', margin: '0 0 4px' }}>{group.title}</h3>
            {group.perms.map(([key, label, desc]) => (
              <PermRow key={key} label={label} description={desc} value={current[key]} onChange={v => setPerm(key, v)} />
            ))}
          </div>
        ))}
        <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-input)' }}>
          Preview only — per-channel permission overrides aren't persisted by the backend yet.
        </div>
      </div>
    </div>
  );
}

function InvitesTab() {
  return (
    <div>
      <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 20px' }}>Invites</h2>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
        Here's a list of all active invite links. You can revoke any one, or <span style={{ color: 'var(--accent)', cursor: 'not-allowed' }}>create one</span>.
      </div>
      <button disabled style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#e06060', color: '#fff', fontSize: 13, opacity: 0.5, cursor: 'not-allowed', marginBottom: 30 }}>
        Pause Invites
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 30 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" width="70" height="70"><path d="M2 12h10M12 12l6-6M12 12l6 6" /></svg>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>No invites yet</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 340 }}>
          Get some friends in here by creating an invite link for this channel.
        </div>
        <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-input)', maxWidth: 340, textAlign: 'center' }}>
          Per-channel invites aren't built yet — joining a network still uses the single network-wide invite code from the "+" menu.
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'permissions', label: 'Permissions' },
  { key: 'invites', label: 'Invites' },
  { key: 'integrations', label: 'Integrations' },
];

export default function ChannelSettingsModal({ network, channel, initialTab = 'overview', onClose, onChannelUpdated, onChannelDeleted }) {
  const [tab, setTab] = useState(initialTab);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function handleDelete() {
    setDeleting(true); setDeleteError('');
    try {
      await networkApi.deleteChannel(network.id, channel.id);
      onChannelDeleted(channel.id);
    } catch (e) {
      setDeleteError(e.message || 'Failed to delete channel.');
      setDeleting(false);
    }
  }

  const typeIcon = channel.type === 'VOICE'
    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
    : <span>#</span>;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-primary)', zIndex: 300, display: 'flex' }}>
      <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--border)', padding: '24px 12px', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '0 8px 14px', fontSize: 11, fontWeight: 700,
          color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3, borderBottom: '1px solid var(--border)', marginBottom: 10,
        }}>
          {typeIcon}<span>{channel.name}</span>
          <span style={{ marginLeft: 4, opacity: 0.7 }}>{channel.type === 'VOICE' ? 'VOICE CHANNELS' : 'TEXT CHANNELS'}</span>
        </div>

        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'block', textAlign: 'left', width: '100%', padding: '8px 10px', marginBottom: 2, borderRadius: 6, border: 'none', cursor: 'pointer',
              background: tab === t.key ? 'var(--bg-hover)' : 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: 13.5, fontWeight: tab === t.key ? 600 : 400,
            }}
          >{t.label}</button>
        ))}

        <div style={{ flex: 1 }} />

        {!confirmingDelete ? (
          <button onClick={() => setConfirmingDelete(true)} style={{ textAlign: 'left', padding: '8px 10px', border: 'none', background: 'none', color: '#e06060', fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            Delete Channel
          </button>
        ) : (
          <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg-input)' }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8 }}>Delete #{channel.name}? This can't be undone.</div>
            {deleteError && <div style={{ fontSize: 12, color: '#e06060', marginBottom: 8 }}>{deleteError}</div>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setConfirmingDelete(false)} disabled={deleting} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', background: '#e06060', color: '#fff', fontSize: 12.5, cursor: 'pointer' }}>{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '48px 40px' }}>
        <div style={{ maxWidth: 660 }}>
          {tab === 'overview' && <OverviewTab networkId={network.id} channel={channel} onChannelUpdated={onChannelUpdated} />}
          {tab === 'permissions' && <PermissionsTab network={network} channel={channel} />}
          {tab === 'invites' && <InvitesTab />}
          {tab === 'integrations' && (
            <div>
              <h2 style={{ fontSize: 20, color: 'var(--text-primary)', margin: '0 0 12px' }}>Integrations</h2>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No integrations yet.</div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onClose}
        title="Close (Esc)"
        style={{
          position: 'absolute', top: 28, right: 40, width: 36, height: 36, borderRadius: '50%',
          border: '2px solid var(--border)', background: 'none', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
      >{CLOSE_BTN}</button>
    </div>
  );
}
