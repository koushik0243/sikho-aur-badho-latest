'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { API_URL } from '../../lib/constant';

// Where each kind of login lands, and how it's named on this page.
const ROLES = {
  storeowner: { label: 'store owner', dashboard: '/storeowner/dashboard' },
  learner:    { label: 'learner',     dashboard: '/learner/dashboard' },
};

/**
 * Opened in a new tab by a super admin's "Log in" icon:
 *   /impersonate?orgId=…  (Organizations)              → that organization's store owner
 *   /impersonate?userId=… (Organization User Assignment) → that learner
 * Gets the login using the super admin's own, keeps it for THIS tab only
 * (public/tab-session.js), then opens that portal's dashboard.
 */
// Starts this tab's login and resolves to the dashboard to open, or null if
// cancelled first. Kept outside the component (no try/catch around throws):
// the React Compiler can't compile `throw` inside try/catch.
async function startImpersonation({ orgId, userId, role, isCancelled }) {
  const tabSession = window.__tabSession;
  if (!tabSession) throw new Error(`This browser blocks the storage needed to log in as a ${role.label}.`);
  const info = tabSession.info();
  if (info && !info.pending) { // this tab is already logged in as someone
    return (ROLES[info.role] || ROLES.storeowner).dashboard;
  }
  if (!orgId && !userId) throw new Error('No organization or learner was chosen.');
  // This tab has no login of its own yet: ask with the super admin's (shared) login.
  const adminToken = tabSession.sharedLogin('adminToken');
  if (!adminToken) throw new Error('Your super admin session has ended — please log in again.');
  const res = await axios.post(`${API_URL}/user/admin/impersonate`, userId ? { userId } : { orgId },
    { headers: { Authorization: `Bearer ${adminToken}` } });
  if (isCancelled()) return null;
  const d = res?.data?.data;
  if (!d?.secret) throw new Error('No login was returned.');
  const { secret, impersonation, ...user } = d;
  tabSession.start({ token: secret, user, userType: user.user_type }, impersonation);
  return (ROLES[impersonation?.role] || role).dashboard;
}

function Impersonate() {
  const params = useSearchParams();
  const orgId = params.get('orgId') || '';
  const userId = params.get('userId') || '';
  const role = ROLES[userId ? 'learner' : 'storeowner'];
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    startImpersonation({ orgId, userId, role, isCancelled: () => cancelled })
      .then((dashboard) => {
        if (dashboard) window.location.replace(dashboard); // full load, so the app starts with this tab's login
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || err?.message || `Could not log in as the ${role.label}.`);
      });
    return () => { cancelled = true; };
  }, [orgId, userId, role]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f7f8', padding: 16 }}>
      <div role={error ? 'alert' : 'status'} style={{ maxWidth: 420, width: '100%', background: '#fff', border: '1px solid #e3ecec', borderRadius: 14, padding: '28px 24px', textAlign: 'center', boxShadow: '0 8px 24px rgba(16,48,47,0.06)' }}>
        {error ? (
          <>
            <h1 style={{ margin: '0 0 8px', color: '#12302f', fontWeight: 800, fontSize: 18 }}>Couldn&apos;t log in as {role.label}</h1>
            <p style={{ margin: '0 0 18px', color: '#6b7d7d', fontSize: 14 }}>{error}</p>
            <button type="button" onClick={() => window.close()}
              style={{ height: 40, padding: '0 18px', borderRadius: 10, border: '1px solid #047279', background: 'linear-gradient(180deg,#047279 0%,#299c8f 100%)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Close this tab
            </button>
          </>
        ) : (
          <>
            <h1 style={{ margin: '0 0 6px', color: '#12302f', fontWeight: 800, fontSize: 18 }}>Logging in as {role.label}…</h1>
            <p style={{ margin: 0, color: '#6b7d7d', fontSize: 14 }}>The {role.label} dashboard opens in a moment.</p>
          </>
        )}
      </div>
    </main>
  );
}

export default function ImpersonatePage() {
  return <Suspense fallback={null}><Impersonate /></Suspense>;
}
