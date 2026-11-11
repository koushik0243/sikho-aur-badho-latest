'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import vpPage from './ViewPaymentMethod.module.css';
import ViewDetailRows, { capitalize } from '../ViewDetailRows';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const vp = withAdminKit(vpPage);

const BASE = '/superadmin/payment-methods';

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

export default function ViewPaymentMethod() {
  const router = useRouter();
  const { id } = useParams();
  const [item, setItem]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    apiServiceHandler('GET', `payment-method/edit/${id}?t=${Date.now()}`)
      .then(res => { if (!cancelled) setItem(res?.data ?? null); })
      .catch(() => { if (!cancelled) setItem(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <SuperAdminShell activeSection="manage-payment-method"><p className={vp.loadingText}>Loading…</p></SuperAdminShell>;
  if (!item?._id) return <SuperAdminShell activeSection="manage-payment-method"><p className={vp.loadingText}>Payment method not found.</p></SuperAdminShell>;


  return (
    <SuperAdminShell activeSection="manage-payment-method">
      <button className={vp.backBtn} onClick={() => router.push(BASE)}>
        {BackArrow} Back to Payment Methods
      </button>
      <div className={vp.viewToolbar}>
        <nav className={vp.breadcrumb}>
          <button className={vp.breadcrumbLink} onClick={() => router.push(BASE)}>Payment Methods</button>
          <span className={vp.breadcrumbSep}>›</span>
          <span className={vp.breadcrumbCurr}>{item.name}</span>
        </nav>
        <button className={vp.btnEdit} onClick={() => router.push(`${BASE}/${id}/edit`)}>
          <EditIcon /> Edit
        </button>
      </div>

      <div className={vp.detailCard}>

        <div className={vp.detailBody}>
          <ViewDetailRows s={vp} rows={[
              { label: 'Name', value: item.name },
              { label: 'Slug', value: item.slug, variant: 'mono' },
              { label: 'Description', value: item.description, variant: 'desc' },
              { label: 'Status', value: capitalize(item.status) },
              { label: 'Created', value: fmtDate(item.createdAt) },
              { label: 'Updated', value: fmtDate(item.updatedAt) },
          ]} />
        </div>
      </div>
    </SuperAdminShell>
  );
}
