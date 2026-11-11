'use client';

import { useEffect } from 'react';
import { touchActivity, isSessionExpired, forceLogout } from '../utils/authSession';

// Ambient user-interaction events that count as "still here". Passive + capture so
// this never interferes with the app's own click/keyboard handlers.
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];

// How often to re-check elapsed time. An interval (not a single long setTimeout) is
// used because setTimeout timers don't fire reliably across system sleep/hibernate —
// re-deriving "expired?" from wall-clock time on each tick is immune to that drift.
const CHECK_INTERVAL_MS = 30 * 1000;

// Only write the activity timestamp at most this often, even if the mouse never
// stops moving — avoids hammering localStorage on every pixel of movement.
const ACTIVITY_THROTTLE_MS = 5 * 1000;

/**
 * Auto-logs the current portal out when the session is stale: 30 minutes of
 * inactivity, or the tab/browser was closed and reopened. Mount once per portal
 * shell (SuperAdmin/StoreOwner/Learner) — it no-ops if nothing is logged in.
 */
export default function useIdleLogout() {
  useEffect(() => {
    // Nothing to guard if there's no session to expire.
    if (!localStorage.getItem('adminToken') && !localStorage.getItem('BHARAT_TOKEN')) return;

    // Catches the exact reported bug: opening the app after being idle past the
    // timeout (even without closing anything) should bounce straight to login.
    if (isSessionExpired()) {
      forceLogout();
      return;
    }

    let lastWrite = 0;
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastWrite < ACTIVITY_THROTTLE_MS) return;
      lastWrite = now;
      touchActivity();
    };

    const checkExpiry = () => {
      if (isSessionExpired()) forceLogout();
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    document.addEventListener('visibilitychange', checkExpiry);
    window.addEventListener('focus', checkExpiry);
    const intervalId = setInterval(checkExpiry, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
      document.removeEventListener('visibilitychange', checkExpiry);
      window.removeEventListener('focus', checkExpiry);
      clearInterval(intervalId);
    };
  }, []);
}
