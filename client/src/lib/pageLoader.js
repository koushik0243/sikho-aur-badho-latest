/*
 * Full-page loading overlay state (see Components/GlobalPageLoader.js).
 *
 * A "page load" starts when the app first opens and whenever a navigation
 * begins (instrumentation-client.js → onRouterTransitionStart). It ends once
 * the new page is showing AND the data requests it made while opening
 * (apiServiceHandler GETs) have all finished — with a short quiet period, since
 * pages fetch from effects right after they render and often chain requests.
 *
 * Requests made after the page has loaded (saving, searching, background
 * refreshes, voice transcription…) are not counted, so the overlay never
 * covers someone who is already working on a page.
 */

const SHOW_DELAY_MS = 150;     // quick page changes don't flash the overlay
const MIN_VISIBLE_MS = 300;    // once shown, it doesn't blink away instantly
const QUIET_MS = 300;          // no page requests for this long = page loaded
const NAV_COMMIT_TIMEOUT_MS = 10 * 1000; // navigation never landed (cancelled, failed)
const MAX_LOAD_MS = 20 * 1000; // hard stop — the overlay can never get stuck
const TICK_MS = 50;

const listeners = new Set();
let visible = false;
let load = null; // { startedAt, fromUrl, committed, pending, lastActivityAt, shownAt }
let timer = null;
let hydrated = false;

const currentUrl = () => (typeof window === 'undefined' ? '' : `${window.location.pathname}${window.location.search}`);

function emit() { listeners.forEach(fn => fn()); }

function setVisible(next) {
  if (visible === next) return;
  visible = next;
  emit();
}

function finish() {
  load = null;
  clearInterval(timer);
  timer = null;
  setVisible(false);
}

function tick() {
  if (!load) return;
  const now = Date.now();
  const age = now - load.startedAt;
  if (age >= MAX_LOAD_MS) { finish(); return; }

  // The new page is on screen once the address changes (a redirect counts too).
  if (!load.committed && (load.fromUrl === null || currentUrl() !== load.fromUrl)) {
    load.committed = true;
    load.lastActivityAt = now;
  }
  if (!load.committed && age >= NAV_COMMIT_TIMEOUT_MS) { finish(); return; }

  const settled = load.committed && hydrated && load.pending === 0 && now - load.lastActivityAt >= QUIET_MS;
  if (settled) {
    if (!visible || now - load.shownAt >= MIN_VISIBLE_MS) finish();
    return;
  }
  if (!visible && age >= SHOW_DELAY_MS) {
    load.shownAt = now;
    setVisible(true);
  }
}

/**
 * Starts a page load. `toUrl` is the navigation target; omit it for the first
 * load of the app. A navigation to the page already shown is ignored.
 */
export function startPageLoad(toUrl) {
  if (typeof window === 'undefined') return;
  let target = null;
  if (toUrl) {
    try {
      const u = new URL(toUrl, window.location.href);
      if (u.origin !== window.location.origin) return;
      target = `${u.pathname}${u.search}`;
    } catch { return; }
    if (target === currentUrl()) return;
  }
  const now = Date.now();
  load = {
    startedAt: now,
    fromUrl: toUrl ? currentUrl() : null,
    committed: false,
    pending: load?.pending ?? 0,
    lastActivityAt: now,
    shownAt: visible ? (load?.shownAt ?? now) : 0,
  };
  if (!timer) timer = setInterval(tick, TICK_MS);
}

/** React has rendered the app (data requests start from effects after this). */
export function markHydrated() {
  hydrated = true;
  if (load) load.lastActivityAt = Date.now();
}

/**
 * Called by apiServiceHandler for each GET. Returns the function to call when
 * the request ends. Only requests made while a page is loading are counted.
 */
export function trackPageRequest() {
  if (!load) return () => {};
  const tracked = load;
  tracked.pending++;
  tracked.lastActivityAt = Date.now();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    // A newer page load carries the count over (see startPageLoad).
    const current = load || tracked;
    current.pending = Math.max(0, current.pending - 1);
    current.lastActivityAt = Date.now();
  };
}

export function subscribePageLoader(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const isPageLoaderVisible = () => visible;
export const isPageLoaderVisibleOnServer = () => false;
