'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./ViewUser.module.css";
import ViewToolbar from '../../ViewToolbar/ViewToolbar';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);
const PersonIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
);

function fmtDate(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d)) return null;
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

const USER_TYPE_LABELS = {
  superadmin: 'Super Admin', creator: 'Creator',
  organization: 'Store Owner', employee: 'Employee',
};

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className={s.infoItem}>
      <div className={s.infoLabel}>{label}</div>
      <span className={s.infoValue}>{value}</span>
    </div>
  );
}

export default function ViewUser() {
  const router = useRouter();
  const { id } = useParams();

  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiServiceHandler('GET', `user/admin/edit/${id}`)
      .then(res => {
        const u = res?.data ?? res;
        if (!u?._id) { setNotFound(true); setLoading(false); return; }
        setUser(u);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  if (loading)  return <SuperAdminShell activeSection="users"><p className={s.loading}>Loading…</p></SuperAdminShell>;
  if (notFound) return <SuperAdminShell activeSection="users"><p className={s.notFound}>User not found.</p></SuperAdminShell>;

  const userType    = USER_TYPE_LABELS[user.user_type] ?? user.user_type ?? null;
  const statusLabel = user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : null;

  return (
    <SuperAdminShell activeSection="users">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/user')}>
        {BackArrow} Back to Users
      </button>

      <ViewToolbar
        parent={{ label: 'Users', onClick: () => router.push('/superadmin/user') }}
        current={user.name || user.email}
        onEdit={() => router.push(`/superadmin/user/${id}/edit`)}
      />

      {/* Profile summary */}
      <div className={s.profileCard}>
        <div className={s.avatar}>{PersonIcon}</div>
        <div className={s.profileInfo}>
          <h1 className={s.profileName}>{user.name || '—'}</h1>
          <p className={s.profileEmail}>{user.email || '—'}</p>
          <div className={s.profileBadges}>
            {userType && (
              <span className={`${s.badgeType} ${s[`badgeType_${user.user_type}`] ?? ''}`}>{userType}</span>
            )}
            {user.status === 'active'
              ? <span className={s.badgeActive}>Active</span>
              : <span className={s.badgeInactive}>{user.status ?? 'Inactive'}</span>}
          </div>
        </div>
      </div>

      {/* Detail fields — only form fields + timestamps */}
      <div className={s.sectionCard}>
        <div className={s.sectionBody}>
          <div className={s.infoGrid}>
            <Row label="Name"       value={user.name} />
            <Row label="Email"      value={user.email} />
            <Row label="Status"     value={statusLabel} />
            <Row label="Created At" value={fmtDate(user.createdAt)} />
            <Row label="Updated At" value={fmtDate(user.updatedAt)} />
          </div>
        </div>
      </div>
    </SuperAdminShell>
  );
}
