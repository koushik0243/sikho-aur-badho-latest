'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import vpPage from "./ViewPermission.module.css";
import ViewDetailRows, { capitalize } from '../ViewDetailRows';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const vp = withAdminKit(vpPage);

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);
const EditIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ViewPermission() {
  const router = useRouter();
  const { id } = useParams();
  const [perm, setPerm]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiServiceHandler('GET', `permission/edit/${id}`)
      .then(res => setPerm(res?.data ?? res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <SuperAdminShell activeSection="permissions"><p className={vp.loadingText}>Loading…</p></SuperAdminShell>;
  if (!perm?._id) return <SuperAdminShell activeSection="permissions"><p className={vp.loadingText}>Permission not found.</p></SuperAdminShell>;

  const displayName = perm.display_name || perm.name || '—';

  return (
    <SuperAdminShell activeSection="permissions">
      <button className={vp.backBtn} onClick={() => router.push('/superadmin/permissions')}>
        {BackArrow} Back to Permissions
      </button>
      <div className={vp.viewToolbar}>
        <nav className={vp.breadcrumb}>
          <button className={vp.breadcrumbLink} onClick={() => router.push('/superadmin/permissions')}>Permissions</button>
          <span className={vp.breadcrumbSep}>›</span>
          <span className={vp.breadcrumbCurr}>{displayName}</span>
        </nav>
        <button className={vp.btnEdit} onClick={() => router.push(`/superadmin/permissions/${id}/edit`)}>
          <EditIcon /> Edit
        </button>
      </div>

      <div className={vp.detailCard}>

        <div className={vp.detailBody}>
          <ViewDetailRows s={vp} rows={[
              { label: 'Key', value: perm.name, variant: 'mono' },
              { label: 'Display Name', value: perm.display_name },
              { label: 'Description', value: perm.desc, variant: 'desc' },
              { label: 'Status', value: capitalize(perm.status) },
              { label: 'Created', value: fmtDate(perm.createdAt) },
              { label: 'Updated', value: fmtDate(perm.updatedAt) },
          ]} />
        </div>
      </div>
    </SuperAdminShell>
  );
}
