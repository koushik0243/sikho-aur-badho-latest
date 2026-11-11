// Session-lifetime utilities shared by all three portals (SuperAdmin, StoreOwner,
// Learner). Backs the three logout triggers requested:
//   1. 30 minutes of inactivity  → IDLE_TIMEOUT_MS + lastActivityAt in localStorage
//      (localStorage so it survives page reloads and a tab left open overnight).
//   2. Browser tab closed        → SESSION_ALIVE_KEY in sessionStorage, which the
//      browser clears automatically when the tab is closed.
//   3. Browser closed            → same sessionStorage marker (also cleared).
//
// The actual auth token stays in localStorage (many pages already read it directly
// from there for one-off requests) — these utilities layer expiry checks on top
// rather than moving where the token lives, keeping the change low-risk.

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const LAST_ACTIVITY_KEY = 'lastActivityAt';
const SESSION_ALIVE_KEY = 'sessionAlive';

const AUTH_LOCAL_KEYS = ['adminToken', 'BHARAT_TOKEN', 'authUser', 'authUserType', LAST_ACTIVITY_KEY];

/** Call right after a successful login/OTP-verify/account-activation. */
export function markSessionAlive() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_ALIVE_KEY, '1');
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

/** Call on any user interaction (mouse move, key press, click, scroll, touch). */
export function touchActivity() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

/**
 * True when the session should be treated as expired:
 * - the tab/browser was closed and reopened (sessionStorage marker is gone), or
 * - more than IDLE_TIMEOUT_MS has passed since the last recorded activity.
 * Only meaningful when a token is actually present — callers should check that first.
 */
export function isSessionExpired() {
  if (typeof window === 'undefined') return false;

  if (!sessionStorage.getItem(SESSION_ALIVE_KEY)) return true;

  const lastActivityRaw = localStorage.getItem(LAST_ACTIVITY_KEY);
  const lastActivity = lastActivityRaw ? Number(lastActivityRaw) : null;
  if (!lastActivity || Number.isNaN(lastActivity)) return true;

  return Date.now() - lastActivity > IDLE_TIMEOUT_MS;
}

/** Clears every stored auth artifact (local + session storage). Safe to call anytime. */
export function clearStoredSession() {
  if (typeof window === 'undefined') return;
  AUTH_LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
  sessionStorage.removeItem(SESSION_ALIVE_KEY);
}

/**
 * Hard-logout: clears storage and sends the browser to /login via a full navigation
 * (not router.push) so every in-memory Redux/component state resets cleanly too.
 */
export function forceLogout() {
  if (typeof window === 'undefined') return;
  clearStoredSession();
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}
