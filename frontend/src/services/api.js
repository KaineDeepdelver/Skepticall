// API base URL — read from environment variable so it never needs to be
// hardcoded here again. Set REACT_APP_API_BASE in your .env file:
//   REACT_APP_API_BASE=https://your-backend-tunnel.trycloudflare.com
// For local dev without a tunnel: REACT_APP_API_BASE=http://localhost:8001
const RAW_API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

// When the page is served over HTTPS, upgrade http:// API URLs to https://
// to avoid Mixed Content errors — BUT never upgrade localhost since it
// doesn't have an SSL cert and https://localhost will always fail.
const isLocalhost = RAW_API_BASE.includes('localhost') || RAW_API_BASE.includes('127.0.0.1');
export const API_BASE = (!isLocalhost && typeof window !== 'undefined' && window.location.protocol === 'https:')
  ? RAW_API_BASE.replace(/^http:/, 'https:')
  : RAW_API_BASE;

// Cloudflare Tunnel — no special headers needed
const NGROK_HEADER = {};

/**
 * Resolves a stored image/file URL to something the browser can actually
 * load, in two cases:
 *  1. Relative paths (e.g. "/uploads/xyz.jpg") — how the backend actually
 *     stores them. These get resolved against the *frontend's* origin by
 *     the browser if left as-is, which is wrong; they need the backend's
 *     origin (API_BASE) prefixed on.
 *  2. Absolute localhost URLs (e.g. "http://localhost:1979/uploads/...")
 *     — leftover from an older dev setup or a different local port. These
 *     get rewritten to the current API_BASE so they still resolve after
 *     moving between dev machines / tunnel URLs / ports.
 *
 * Usage: <img src={resolveUrl(user.profilePicture)} />
 */
export function resolveUrl(url) {
  if (!url) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return `${API_BASE}${parsed.pathname}${parsed.search}`;
    }
  } catch {}
  return url;
}

// Auth endpoints someone without an account must still be able to hit
// (signing up, logging in). Everything else that mutates data requires
// a real account — "guest" is simply the absence of a token.
const GUEST_EXEMPT_PREFIXES = [
  '/users/register', '/users/login', '/users/check-email', '/users/check-username',
  '/users/send-registration-code', '/users/verify-registration-code',
  '/users/send-reset-code', '/users/reset-password',
];

async function req(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  if (
    method !== 'GET' &&
    !sessionStorage.getItem('omni_token') &&
    !GUEST_EXEMPT_PREFIXES.some(p => path.startsWith(p))
  ) {
    window.dispatchEvent(new Event('omni:guest-blocked'));
    throw new Error('GUEST_MODE_BLOCKED');
  }

  const token = sessionStorage.getItem('omni_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...NGROK_HEADER,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
    body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 || (res.status === 403 && token === null)) {
    // No token, or backend says it's invalid/expired — stop pretending we're
    // logged in. Clear stale auth state and tell the app so it can redirect
    // to login instead of silently 403ing on every call forever.
    sessionStorage.removeItem('omni_token');
    sessionStorage.removeItem('omni_user');
    sessionStorage.removeItem('omni_user_id');
    window.dispatchEvent(new Event('omni:auth-expired'));
  }
  if (!res.ok) throw new Error(await res.text());
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.text();
}

// `method` defaults to POST since that covers most upload() call sites
// (createPost, uploadMedia, uploadMessage, network icon/banner) — but
// callers that hit a @PutMapping endpoint (updateProfile) MUST pass 'PUT'
// explicitly, or the request 404s/405s against a route that doesn't
// actually have a POST handler.
function upload(path, formData, method = 'POST') {
  const token = sessionStorage.getItem('omni_token');
  return fetch(`${API_BASE}${path}`, {
    method,
    body: formData,
    headers: {
      ...NGROK_HEADER,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }).then(r => {
    if (r.status === 401 || (r.status === 403 && token === null)) {
      // Same expired/invalid-token recovery as req() below — uploads (posts,
      // media, profile pics, message attachments) were previously silently
      // failing here with no way for the app to know the user got logged out.
      sessionStorage.removeItem('omni_token');
      sessionStorage.removeItem('omni_user');
      sessionStorage.removeItem('omni_user_id');
      window.dispatchEvent(new Event('omni:auth-expired'));
    }
    if (!r.ok) return r.text().then(t => { throw new Error(t); });
    return r.json();
  });
}

export const api = {
  // Auth — login/register responses are now { token, user }
  checkEmail:    (email)           => req('/users/check-email',    { method: 'POST', body: { email } }),
  checkUsername: (username)        => req('/users/check-username', { method: 'POST', body: { username } }),
  login:         (email, password) => req('/users/login',          { method: 'POST', body: { email, password } }),
  register:      (data)            => req('/users/register',       { method: 'POST', body: data }),

  // Users
  getUser:           (id)       => req(`/users/${id}`),
  getUserByUsername: (username) => req(`/users/by-username/${encodeURIComponent(username)}`),
  searchUsers:    (query)           => req(`/users/search?query=${encodeURIComponent(query)}`),
  updateProfile:  (id, fd)          => upload(`/users/${id}/profile`, fd, 'PUT'),
  updateAccount:  (id, body)        => req(`/users/${id}/account`,  { method: 'PUT', body }),
  updatePrivacy:  (id, privacyMode) => req(`/users/${id}/privacy`,  { method: 'PUT', body: { privacyMode } }),
  // Generic settings patch (presence, notifications, security flags, etc.)
  updateSettings: (id, body)        => req(`/users/${id}/settings`, { method: 'PUT', body }),
  deleteAccount:  (id, password)    => req(`/users/${id}`,          { method: 'DELETE', body: { password } }),
  setPresence:    (id, online)      => fetch(`${API_BASE}/users/${id}/presence`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...NGROK_HEADER,
      // Token attached when available so the backend can verify it's really
      // this user; presence still works without one (tab-close beacon race).
      ...(sessionStorage.getItem('omni_token')
        ? { Authorization: `Bearer ${sessionStorage.getItem('omni_token')}` }
        : {}),
    },
    body: JSON.stringify({ online }),
    keepalive: true,
  }).catch(() => {}), // presence is best-effort — never crash the UI on network errors

  // Messages
  getConversations: (userId)       => req(`/users/${userId}/conversations`),
  getHistory:       (u1, u2)       => req(`/messages/${u1}/${u2}`),
  uploadMessage:    (fd)           => upload('/messages/upload', fd),
};

// Friends
export const friendApi = {
  sendRequest:  (targetId)          => req(`/friends/request/${targetId}`, { method: 'POST' }),
  respond:      (requestId, action) => req(`/friends/respond/${requestId}?action=${action}`, { method: 'POST' }),
  unfriend:     (otherId)           => req(`/friends/${otherId}`, { method: 'DELETE' }),
  relationship: (targetId, viewerId) => req(`/friends/relationship/${targetId}?viewerId=${viewerId}`),
  list:         (userId)            => req(`/friends/list?userId=${userId}`),
};

// Groups — creatorId/requesterId dropped from bodies; JWT supplies the actor
export const groupApi = {
  create:       (name, memberIds)         => req('/groups', { method: 'POST', body: { name, memberIds } }),
  getForUser:   (userId)                  => req(`/groups/user/${userId}`),
  getMessages:  (groupId)                 => req(`/groups/${groupId}/messages`),
  rename:       (groupId, name)           => req(`/groups/${groupId}/rename`, { method: 'PATCH', body: { name } }),
  addMembers:   (groupId, memberIds)      => req(`/groups/${groupId}/members`, { method: 'POST', body: { memberIds } }),
  removeMember: (groupId, memberId)       => req(`/groups/${groupId}/members/${memberId}`, { method: 'DELETE' }),
  leave:        (groupId)                 => req(`/groups/${groupId}/leave`, { method: 'DELETE' }),
  updatePermissions: (groupId, perms)     => req(`/groups/${groupId}/permissions`, { method: 'PATCH', body: perms }),
};

// Notifications
export const notifApi = {
  getAll:      (userId)  => req(`/notifications?userId=${userId}`),
  unreadCount: (userId)  => req(`/notifications/unread-count?userId=${userId}`),
  markOneRead: (notifId) => req(`/notifications/${notifId}/read`, { method: 'POST' }),
};

export const linkPreviewApi = {
  fetch: (url) => req(`/link-preview?url=${encodeURIComponent(url)}`),
};

// Admin — adminId is gone entirely. The backend verifies the caller is an
// admin by validating the JWT and checking the admins table server-side;
// a client can no longer just type a different adminId into the URL bar.
export const adminApi = {
  listUsers:     ()             => req('/admin/users'),
  deleteUser:    (userId)       => req(`/admin/users/${userId}`, { method: 'DELETE' }),
  grantAdmin:    (targetUserId) => req(`/admin/admins/${targetUserId}`, { method: 'POST' }),
  revokeAdmin:   (targetUserId) => req(`/admin/admins/${targetUserId}`, { method: 'DELETE' }),
};
