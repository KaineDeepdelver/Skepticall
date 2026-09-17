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
  updateNameColor: (id, nameColor) => req(`/users/${id}/name-color`, { method: 'PUT', body: { nameColor } }),
  updateAvatarOverlay: (id, svg) => req(`/users/${id}/avatar-overlay`, { method: 'PUT', body: { svg } }),
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
  getPresence:    (id)              => req(`/users/${id}/presence`),

  // Messages
  getConversations: (userId)       => req(`/users/${userId}/conversations`),
  getHistory:       (u1, u2)       => req(`/messages/${u1}/${u2}`),
  uploadMessage:    (fd)           => upload('/messages/upload', fd),

  // Posts — userId/adminId params dropped; the backend now derives the actor
  // from the JWT instead of trusting whatever the client claims to be.
  getPostBySlug: (slug)               => req(`/posts/slug/${encodeURIComponent(slug)}`),
  getPosts:      (page = 0, viewerId) => req(`/posts?page=${page}&size=20${viewerId ? `&viewerId=${viewerId}` : ''}`),
  getUserPosts:  (authorId, page = 0, viewerId) => req(`/posts/user/${authorId}?page=${page}&size=20${viewerId ? `&viewerId=${viewerId}` : ''}`),
  createPost:    (fd)                  => upload('/posts', fd),
  votePost:      (id, type)            => req(`/posts/${id}/vote?voteType=${type}`, { method: 'POST' }),
  deletePost:    (id)                  => req(`/posts/${id}`, { method: 'DELETE' }),
  deleteMedia:   (id)                  => req(`/media/${id}`, { method: 'DELETE' }),
  deleteComment: (id)                  => req(`/comments/${id}`, { method: 'DELETE' }),
  searchPosts:   (q, viewerId)         => req(`/posts/search?q=${encodeURIComponent(q)}${viewerId ? `&viewerId=${viewerId}` : ''}`),

  // Media
  getMedia:      (page = 0, viewerId) => req(`/media?page=${page}&size=20${viewerId ? `&viewerId=${viewerId}` : ''}`),
  uploadMedia:   (fd)                  => upload('/media', fd),
  getClips:      (viewerId)            => req(`/media/clips${viewerId ? `?viewerId=${viewerId}` : ''}`),
  voteMedia:     (id, type)            => req(`/media/${id}/vote?voteType=${type}`, { method: 'POST' }),
  viewMedia:     (id)                  => req(`/media/${id}/view`, { method: 'POST' }),
  searchMedia:   (q, viewerId)         => req(`/media/search?q=${encodeURIComponent(q)}${viewerId ? `&viewerId=${viewerId}` : ''}`),
  getUserMedia:  (authorId, viewerId)  => req(`/media/user/${authorId}${viewerId ? `?viewerId=${viewerId}` : ''}`),

  // Comments
  getPostComments:  (postId, viewerId)  => req(`/comments/post/${postId}${viewerId ? `?viewerId=${viewerId}` : ''}`),
  getMediaComments: (mediaId, viewerId) => req(`/comments/media/${mediaId}${viewerId ? `?viewerId=${viewerId}` : ''}`),
  addPostComment:   (postId, body)      => req(`/comments/post/${postId}`,   { method: 'POST', body }),
  addMediaComment:  (mediaId, body)     => req(`/comments/media/${mediaId}`, { method: 'POST', body }),
  voteComment:      (id, type)          => req(`/comments/${id}/vote?voteType=${type}`, { method: 'POST' }),
  reactComment:     (id, emoji)         => req(`/comments/${id}/react?emoji=${encodeURIComponent(emoji)}`, { method: 'POST' }),
};

// Follow
export const followApi = {
  toggle:  (targetId)           => req(`/follow/${targetId}/toggle`, { method: 'POST' }),
  status:  (targetId, viewerId) => req(`/follow/${targetId}/status?viewerId=${viewerId}`),
};

// Friends
export const friendApi = {
  sendRequest:  (targetId)          => req(`/friends/request/${targetId}`, { method: 'POST' }),
  respond:      (requestId, action) => req(`/friends/respond/${requestId}?action=${action}`, { method: 'POST' }),
  unfriend:     (otherId)           => req(`/friends/${otherId}`, { method: 'DELETE' }),
  relationship: (targetId, viewerId) => req(`/friends/relationship/${targetId}?viewerId=${viewerId}`),
  pending:      (userId)            => req(`/friends/pending?userId=${userId}`),
  list:         (userId)            => req(`/friends/list?userId=${userId}`),
};

// Groups — creatorId/requesterId dropped from bodies; JWT supplies the actor
export const groupApi = {
  create:       (name, memberIds)         => req('/groups', { method: 'POST', body: { name, memberIds } }),
  getForUser:   (userId)                  => req(`/groups/user/${userId}`),
  get:          (groupId)                 => req(`/groups/${groupId}`),
  getMessages:  (groupId)                 => req(`/groups/${groupId}/messages`),
  rename:       (groupId, name)           => req(`/groups/${groupId}/rename`, { method: 'PATCH', body: { name } }),
  addMembers:   (groupId, memberIds)      => req(`/groups/${groupId}/members`, { method: 'POST', body: { memberIds } }),
  removeMember: (groupId, memberId)       => req(`/groups/${groupId}/members/${memberId}`, { method: 'DELETE' }),
  leave:        (groupId)                 => req(`/groups/${groupId}/leave`, { method: 'DELETE' }),
  updatePermissions: (groupId, perms)     => req(`/groups/${groupId}/permissions`, { method: 'PATCH', body: perms }),
};

// Comment replies — authorId dropped, derived from JWT server-side
export const replyApi = {
  getReplies: (commentId, viewerId) => req(`/comments/${commentId}/replies${viewerId ? `?viewerId=${viewerId}` : ''}`),
  addReply:   (commentId, content)  => req(`/comments/${commentId}/reply`, { method: 'POST', body: { content } }),
};

// Notifications
export const notifApi = {
  getAll:      (userId)  => req(`/notifications?userId=${userId}`),
  unreadCount: (userId)  => req(`/notifications/unread-count?userId=${userId}`),
  markRead:    (userId)  => req(`/notifications/mark-read?userId=${userId}`, { method: 'POST' }),
  markOneRead: (notifId) => req(`/notifications/${notifId}/read`, { method: 'POST' }),
};

export const linkPreviewApi = {
  fetch: (url) => req(`/link-preview?url=${encodeURIComponent(url)}`),
};

// Networks — same convention as groupApi: requesterId/ownerId never sent in
// the body, the backend derives the actor from the JWT (authenticatedUserId).
export const networkApi = {
  create:      (name, iconUrl)       => req('/networks', { method: 'POST', body: { name, iconUrl } }),
  mine:        ()                    => req('/networks/mine'),
  get:         (networkId)           => req(`/networks/${networkId}`),
  join:        (inviteCode)          => req('/networks/join', { method: 'POST', body: { inviteCode } }),
  leave:       (networkId)           => req(`/networks/${networkId}/leave`, { method: 'DELETE' }),
  getMembers:  (networkId)           => req(`/networks/${networkId}/members`),
  kickMember:  (networkId, userId)   => req(`/networks/${networkId}/members/${userId}`, { method: 'DELETE' }),

  // Server Profile / Access / Safety Setup — partial update, only send
  // the keys that changed. See NetworkController#update for the shape.
  updateNetwork: (networkId, patch)  => req(`/networks/${networkId}`, { method: 'PATCH', body: patch }),
  updateIcon:    (networkId, fd)     => upload(`/networks/${networkId}/icon`, fd),
  removeIcon:    (networkId)         => req(`/networks/${networkId}/icon`, { method: 'DELETE' }),
  updateBanner:  (networkId, fd)     => upload(`/networks/${networkId}/banner`, fd),
  removeBanner:  (networkId)         => req(`/networks/${networkId}/banner`, { method: 'DELETE' }),

  // Bans — separate from kick: a ban also blocks rejoining via invite code.
  getBans:     (networkId)                 => req(`/networks/${networkId}/bans`),
  banMember:   (networkId, userId, reason) => req(`/networks/${networkId}/bans`, { method: 'POST', body: { userId, reason } }),
  unbanMember: (networkId, userId)         => req(`/networks/${networkId}/bans/${userId}`, { method: 'DELETE' }),

  // Roles
  createRole:  (networkId, body)               => req(`/networks/${networkId}/roles`, { method: 'POST', body }),
  updateRole:  (networkId, roleId, body)        => req(`/networks/${networkId}/roles/${roleId}`, { method: 'PATCH', body }),
  deleteRole:  (networkId, roleId)              => req(`/networks/${networkId}/roles/${roleId}`, { method: 'DELETE' }),
  assignRole:  (networkId, userId, roleId)      => req(`/networks/${networkId}/members/${userId}/roles/${roleId}`, { method: 'POST' }),
  removeRole:  (networkId, userId, roleId)      => req(`/networks/${networkId}/members/${userId}/roles/${roleId}`, { method: 'DELETE' }),

  // Channels
  getChannels:    (networkId)                   => req(`/networks/${networkId}/channels`),
  createChannel:  (networkId, name, type, categoryId) => req(`/networks/${networkId}/channels`, { method: 'POST', body: { name, type, categoryId } }),
  renameChannel:  (networkId, channelId, name)  => req(`/networks/${networkId}/channels/${channelId}`, { method: 'PATCH', body: { name } }),
  deleteChannel:  (networkId, channelId)        => req(`/networks/${networkId}/channels/${channelId}`, { method: 'DELETE' }),
  moveChannelToCategory: (networkId, channelId, categoryId) => req(`/networks/${networkId}/channels/${channelId}/category`, { method: 'PATCH', body: { categoryId } }),

  // Categories
  createCategory: (networkId, name)             => req(`/networks/${networkId}/categories`, { method: 'POST', body: { name } }),
  renameCategory: (networkId, categoryId, name) => req(`/networks/${networkId}/categories/${categoryId}`, { method: 'PATCH', body: { name } }),
  deleteCategory: (networkId, categoryId)       => req(`/networks/${networkId}/categories/${categoryId}`, { method: 'DELETE' }),

  // Messages
  getChannelMessages: (networkId, channelId, page = 0, size = 50) =>
    req(`/networks/${networkId}/channels/${channelId}/messages?page=${page}&size=${size}`),
  postChannelMessage: (networkId, channelId, content, fileUrl, parentId) =>
    req(`/networks/${networkId}/channels/${channelId}/messages`, { method: 'POST', body: { content, fileUrl, parentId } }),
  // Voice notes — multipart, mirrors messageApi's DM/group upload.
  uploadChannelVoiceMessage: (networkId, channelId, fd) =>
    upload(`/networks/${networkId}/channels/${channelId}/messages/upload`, fd),
  editChannelMessage: (networkId, channelId, messageId, content) =>
    req(`/networks/${networkId}/channels/${channelId}/messages/${messageId}`, { method: 'PATCH', body: { content } }),
  deleteChannelMessage: (networkId, channelId, messageId) =>
    req(`/networks/${networkId}/channels/${channelId}/messages/${messageId}`, { method: 'DELETE' }),
};

// Admin — adminId is gone entirely. The backend verifies the caller is an
// admin by validating the JWT and checking the admins table server-side;
// a client can no longer just type a different adminId into the URL bar.
export const adminApi = {
  check:         (userId)       => req(`/admin/check/${userId}`),
  listUsers:     ()             => req('/admin/users'),
  deletePost:    (postId)       => req(`/admin/posts/${postId}`, { method: 'DELETE' }),
  deleteComment: (commentId)    => req(`/admin/comments/${commentId}`, { method: 'DELETE' }),
  deleteMedia:   (mediaId)      => req(`/admin/media/${mediaId}`, { method: 'DELETE' }),
  deleteUser:    (userId)       => req(`/admin/users/${userId}`, { method: 'DELETE' }),
  listAdmins:    ()             => req('/admin/admins'),
  grantAdmin:    (targetUserId) => req(`/admin/admins/${targetUserId}`, { method: 'POST' }),
  revokeAdmin:   (targetUserId) => req(`/admin/admins/${targetUserId}`, { method: 'DELETE' }),
  grantPremium:  (targetUserId) => req(`/admin/users/${targetUserId}/premium`, { method: 'POST' }),
  revokePremium: (targetUserId) => req(`/admin/users/${targetUserId}/premium`, { method: 'DELETE' }),
};
