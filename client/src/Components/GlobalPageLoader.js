'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  subscribePageLoader, isPageLoaderVisible, isPageLoaderVisibleOnServer, markHydrated,
} from '../lib/pageLoader';
import s from './GlobalPageLoader.module.css';

// Dark full-screen overlay with a spinner, shown while any page is opening —
// see lib/pageLoader.js for when it appears and disappears.
export default function GlobalPageLoader() {
  const visible = useSyncExternalStore(subscribePageLoader, isPageLoaderVisible, isPageLoaderVisibleOnServer);

  useEffect(() => { markHydrated(); }, []);

  if (!visible) return null;
  return (
    <div className={s.overlay} role="status" aria-live="polite" aria-busy="true">
      <div className={s.spinner} aria-hidden="true" />
      <span className={s.srOnly}>Loading…</span>
    </div>
  );
}
