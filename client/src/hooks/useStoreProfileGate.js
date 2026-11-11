'use client';

import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { usePathname, useRouter } from 'next/navigation';
import { selectUser, selectAuthReady, selectIsAuthenticated } from '../redux/slices/authSlice';
import apiServiceHandler from '../service/apiService';

const PROFILE_PATH = '/storeowner/profile';

// Mirrors exactly the fields rendered on the Store Profile page
// (Components/StoreOwner/Profile/StoreProfile.js) — a new org owner only fills in
// org name/email/phone/password at signup (OrganizationSignup.js), so WhatsApp No,
// Industry, and Number Of Employees are still blank until they complete it here.
const REQUIRED_ORG_FIELDS = ['org_name', 'industry', 'emp_count'];
const REQUIRED_PERSONAL_FIELDS = ['email', 'whatsapp_no'];

function isFilled(v) {
  return v !== null && v !== undefined && String(v).trim() !== '';
}

async function fetchIsProfileComplete(user) {
  const extract = (res) => res?.data ?? res;
  const userId = user?._id ? String(user._id) : null;
  if (!userId) return true; // no identity to check against — never trap the caller

  try {
    const userRes    = await apiServiceHandler('GET', `user/admin/edit/${userId}`).catch(() => null);
    const userRecord = extract(userRes) || {};
    if (REQUIRED_PERSONAL_FIELDS.some(f => !isFilled(userRecord[f]))) return false;

    let orgId = user?.orgId ? String(user.orgId?._id ?? user.orgId) : (userRecord.orgId ? String(userRecord.orgId) : null);
    let orgData = null;
    if (orgId) {
      const orgRes = await apiServiceHandler('GET', `organization/${orgId}`).catch(() => null);
      orgData = extract(orgRes);
    }
    if (!orgData) {
      const listRes = await apiServiceHandler('GET', `organization/list?ownerId=${userId}`).catch(() => null);
      const list = extract(listRes);
      orgData = (Array.isArray(list) ? list : [])[0] || null;
    }
    if (!orgData) return false; // signed up but no org record yet — treat as incomplete

    return !REQUIRED_ORG_FIELDS.some(f => !isFilled(orgData[f]));
  } catch {
    return true; // a transient API failure must never trap the owner in a redirect loop
  }
}

/**
 * Confines a store owner to the Store Profile page until every field there is filled
 * in. Only applies to the org OWNER (the account created via the public organization
 * signup, which only collects name/email/phone/password) — sub-users (admin/manager/
 * employee) are never gated. Once the profile is confirmed complete it's never
 * rechecked again for the rest of the session.
 */
export default function useStoreProfileGate() {
  const user      = useSelector(selectUser);
  const authReady = useSelector(selectAuthReady);
  const isAuthed  = useSelector(selectIsAuthenticated);
  const pathname  = usePathname();
  const router    = useRouter();

  const confirmedComplete = useRef(false);

  useEffect(() => {
    if (!authReady || !isAuthed) return;
    if (user?.orgRole !== 'owner') return;
    if (confirmedComplete.current) return;

    let cancelled = false;
    fetchIsProfileComplete(user).then(complete => {
      if (cancelled) return;
      if (complete) {
        confirmedComplete.current = true;
        return;
      }
      if (pathname !== PROFILE_PATH) router.replace(PROFILE_PATH);
    });
    return () => { cancelled = true; };
  }, [authReady, isAuthed, user, pathname, router]);
}
