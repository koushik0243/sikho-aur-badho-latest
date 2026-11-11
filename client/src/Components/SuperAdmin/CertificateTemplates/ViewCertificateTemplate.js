'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./ViewCertificateTemplate.module.css";
import ViewToolbar from '../../ViewToolbar/ViewToolbar';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackArrow = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function Row({ label, value }) {
  return (
    <div className={s.viewRow}>
      <div className={s.viewLabel}>{label}</div>
      {value ? <div className={s.viewValue}>{value}</div> : <div className={s.viewValueMuted}>—</div>}
    </div>
  );
}

export default function ViewCertificateTemplate() {
  const router = useRouter();
  const { id } = useParams();
  const [tpl, setTpl]         = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiServiceHandler('GET', `certificate-template/details/${id}`)
      .then(res => setTpl(res?.data ?? res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <SuperAdminShell activeSection="certificate-template"><p style={{ padding: 40, color: '#6b7280' }}>Loading…</p></SuperAdminShell>;
  if (!tpl?._id) return <SuperAdminShell activeSection="certificate-template"><p style={{ padding: 40, color: '#6b7280' }}>Template not found.</p></SuperAdminShell>;

  return (
    <SuperAdminShell activeSection="certificate-template">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/certificate-template')}>
        <BackArrow /> Back to Certificate Templates
      </button>

      <ViewToolbar
        parent={{ label: 'Certificate Templates', onClick: () => router.push('/superadmin/certificate-template') }}
        current={tpl.title}
        onEdit={() => router.push(`/superadmin/certificate-template/${id}/edit`)}
      />

      <div className={s.viewCard}>
        <div className={s.viewGrid}>
          <Row label="Title"      value={tpl.title} />
          <Row label="Created At" value={fmtDate(tpl.createdAt)} />
          <Row label="Updated At" value={fmtDate(tpl.updatedAt)} />
        </div>
        {tpl.desc && (
          <div style={{ marginTop: 20 }}>
            <div className={s.viewLabel}>Template HTML</div>
            <iframe
              srcDoc={tpl.desc}
              title="Certificate Preview"
              sandbox="allow-same-origin"
              style={{ width: '100%', height: 620, border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 12, display: 'block' }}
            />
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}
