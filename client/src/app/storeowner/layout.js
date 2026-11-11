'use client';

import { usePathname } from 'next/navigation';
import StoreOwnerShell from '../../Components/StoreOwner/StoreOwnerShell';

// The signup page is public (no login required) and shouldn't be wrapped in the
// authenticated dashboard chrome (sidebar, topbar, notifications) that every other
// /storeowner/* route gets — everything else keeps going through StoreOwnerShell as before.
const PUBLIC_PATHS = ['/storeowner/signup'];

export default function StoreOwnerLayout({ children }) {
  const pathname = usePathname();
  if (PUBLIC_PATHS.includes(pathname)) {
    return children;
  }
  return <StoreOwnerShell>{children}</StoreOwnerShell>;
}
