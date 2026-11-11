'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./ViewEmployee.module.css";
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

// Date + time, so an update made the same day still shows a different Updated At.
function fmtDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  return `${fmtDate(d)}, ${time}`;
}

function Row({ label, value }) {
  return (
    <tr>
      <th scope="row" className={s.detailTh}>{label}</th>
      <td className={value ? s.detailTd : `${s.detailTd} ${s.detailTdMuted}`}>{value || '—'}</td>
    </tr>
  );
}

export default function ViewEmployee() {
  const router = useRouter();
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiServiceHandler('GET', `user/admin/edit/${id}?t=${Date.now()}`)
      .then(res => setUser(res?.data ?? res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <SuperAdminShell activeSection="employees"><p style={{ padding: 40, color: '#6b7280' }}>Loading…</p></SuperAdminShell>;
  if (!user?._id) return <SuperAdminShell activeSection="employees"><p style={{ padding: 40, color: '#6b7280' }}>User not found.</p></SuperAdminShell>;

  return (
    <SuperAdminShell activeSection="employees">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/employees')}>
        <BackArrow /> Back to Users
      </button>

      <ViewToolbar
        parent={{ label: 'Users', onClick: () => router.push('/superadmin/employees') }}
        current={user.name || user.email}
        onEdit={() => router.push(`/superadmin/employees/${id}/edit`)}
      />

      <div className={s.detailTableWrap}>
        <table className={s.detailTable}>
          <tbody>
          <Row label="Name"       value={user.name} />
          <Row label="Email"      value={user.email} />
          <Row label="WhatsApp No" value={user.whatsapp_no} />
          <Row label="Employee ID" value={user.emp_id} />
          <Row label="Department" value={user.department} />
          <Row label="Designation" value={user.designation} />
          <Row label="Language Preference" value={user.course_language} />
          <Row label="Access Start Date" value={user.access_start ? fmtDate(user.access_start) : null} />
          <Row label="Status"     value={user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : null} />
          <Row label="User Type"  value={user.user_type} />
          <Row label="Created At" value={fmtDateTime(user.createdAt)} />
          <Row label="Updated At" value={fmtDateTime(user.updatedAt)} />
          </tbody>
        </table>
      </div>
    </SuperAdminShell>
  );
}
