'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import vpPage from "./ViewTag.module.css";
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

export default function ViewTag() {
  const router = useRouter();
  const { id } = useParams();
  const [tag, setTag]         = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiServiceHandler('GET', `tags/details/${id}`)
      .then(res => setTag(res?.data ?? res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <SuperAdminShell activeSection="tags"><p className={vp.loadingText}>Loading…</p></SuperAdminShell>;
  if (!tag?._id) return <SuperAdminShell activeSection="tags"><p className={vp.loadingText}>Tag not found.</p></SuperAdminShell>;


  return (
    <SuperAdminShell activeSection="tags">
      <button className={vp.backBtn} onClick={() => router.push('/superadmin/tags')}>
        {BackArrow} Back to Tags
      </button>
      <div className={vp.viewToolbar}>
        <nav className={vp.breadcrumb}>
          <button className={vp.breadcrumbLink} onClick={() => router.push('/superadmin/tags')}>Tags</button>
          <span className={vp.breadcrumbSep}>›</span>
          <span className={vp.breadcrumbCurr}>{tag.title}</span>
        </nav>
        <button className={vp.btnEdit} onClick={() => router.push(`/superadmin/tags/${id}/edit`)}>
          <EditIcon /> Edit
        </button>
      </div>

      <div className={vp.detailCard}>

        <div className={vp.detailBody}>
          <ViewDetailRows s={vp} rows={[
              { label: 'Title', value: tag.title },
              { label: 'Slug', value: tag.slug, variant: 'mono' },
              { label: 'Description', value: tag.desc, variant: 'desc' },
              { label: 'Status', value: capitalize(tag.status) },
              { label: 'Created', value: fmtDate(tag.createdAt) },
              { label: 'Updated', value: fmtDate(tag.updatedAt) },
          ]} />
        </div>
      </div>
    </SuperAdminShell>
  );
}
