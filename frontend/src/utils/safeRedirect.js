/**
 * Where to send someone after signing in, when the address contains `?next=...`.
 *
 * Only paths inside this app are allowed. Anything else (another site, a protocol-relative
 * `//evil.example`, a backslash trick like `/\evil.example`, `javascript:` and so on) falls back to
 * the home page, so a crafted login link can't bounce a freshly signed-in person to a phishing site.
 */
export function safeNext(next, fallback = '/') {
  if (typeof next !== 'string' || next.length === 0 || next.length > 2048) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback; // control characters and backslashes
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  try {
    const url = new URL(next, 'http://app.invalid'); // resolve exactly as a browser would
    if (url.origin !== 'http://app.invalid') return fallback;
  } catch {
    return fallback;
  }
  return next;
}
