'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Account areas where the browser's right-click menu is disabled (content
// protection — e.g. "Save video as…", "Copy image address").
const PROTECTED_PREFIXES = ['/learner', '/storeowner', '/superadmin'];

// Text fields keep their menu so learners/admins can still paste, spell-check, etc.
function isEditable(target) {
  if (!(target instanceof Element)) return false;
  return !!target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

export default function DisableContextMenu() {
  const pathname = usePathname() || '';
  const isProtected = PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (!isProtected) return;
    const block = (e) => { if (!isEditable(e.target)) e.preventDefault(); };
    document.addEventListener('contextmenu', block);
    return () => document.removeEventListener('contextmenu', block);
  }, [isProtected]);

  return null;
}
