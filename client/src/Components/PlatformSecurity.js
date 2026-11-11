'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Content protection for the three account areas (learner / store owner /
// super admin). These are deterrents — a browser can't stop OS-level screen
// recorders or a determined user — but they block the easy ways to save or
// capture course content:
//  • right-click menu (except in text fields, so paste/spell-check still work)
//  • save / view-source / print / dev-tools shortcuts
//  • Print Screen → the page is blanked for a moment and the clipboard cleared
//  • printing the page → prints blank (see globals.css)
//  • dragging images/videos out of the page
// Certificate printing opens its own window, so it isn't affected.

const PROTECTED_PREFIXES = ['/learner', '/storeowner', '/superadmin'];
const PROTECTED_CLASS = 'protected-area';
const CAPTURE_CLASS = 'capture-blocked';
const PRINTSCREEN_BLANK_MS = 1500;

function isEditable(target) {
  if (!(target instanceof Element)) return false;
  return !!target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

// Kept outside the component: the React Compiler can't compile optional
// chaining inside try/catch.
function clearClipboard() {
  try {
    navigator.clipboard?.writeText('').catch(() => { /* permission denied */ });
  } catch { /* clipboard not available */ }
}

// Ctrl/⌘+S (save), U (view source), P (print); F12, Ctrl+Shift+I/J/C and
// ⌘+⌥+I/J/C (dev tools).
function isBlockedShortcut(e) {
  const key = String(e.key || '').toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  if (key === 'f12') return true;
  if (mod && ['s', 'u', 'p'].includes(key)) return true;
  if (mod && (e.shiftKey || e.altKey) && ['i', 'j', 'c'].includes(key)) return true;
  return false;
}

export default function PlatformSecurity() {
  const pathname = usePathname() || '';
  const isProtected = PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (!isProtected) return;
    const root = document.documentElement;
    root.classList.add(PROTECTED_CLASS);
    let blankTimer = null;

    const onContextMenu = (e) => { if (!isEditable(e.target)) e.preventDefault(); };

    const onKeyDown = (e) => {
      if (isBlockedShortcut(e)) { e.preventDefault(); e.stopPropagation(); }
    };

    const onKeyUp = (e) => {
      if (e.key !== 'PrintScreen') return;
      root.classList.add(CAPTURE_CLASS);
      clearClipboard();
      clearTimeout(blankTimer);
      blankTimer = setTimeout(() => root.classList.remove(CAPTURE_CLASS), PRINTSCREEN_BLANK_MS);
    };

    const onDragStart = (e) => {
      const t = e.target;
      if (t instanceof Element && t.closest('img, video, picture, canvas')) e.preventDefault();
    };

    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('dragstart', onDragStart);
    return () => {
      root.classList.remove(PROTECTED_CLASS, CAPTURE_CLASS);
      clearTimeout(blankTimer);
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('dragstart', onDragStart);
    };
  }, [isProtected]);

  return null;
}
