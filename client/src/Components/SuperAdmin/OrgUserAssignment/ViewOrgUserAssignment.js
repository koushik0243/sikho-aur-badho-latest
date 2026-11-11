'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import vpPage from "./ViewOrgUserAssignment.module.css";
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

export default function ViewOrgUserAssignment() {
  const router = useRouter();
  const { id } = useParams();
  const [user, setUser]       = useState(null);
  const [orgName, setOrgName] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiServiceHandler('GET', `user/admin/edit/${id}`)
      .then(async res => {
        const u = res?.data ?? res;
        setUser(u);
        if (!u?.orgId) return;
        if (typeof u.orgId === 'object') {
          setOrgName(u.orgId.org_name || u.orgId.name || null);
        } else {
          try {
            const orgRes = await apiServiceHandler('GET', `organization/edit/${u.orgId}`);
            const org = orgRes?.data ?? orgRes;
            setOrgName(org?.org_name || org?.name || null);
          } catch {
            setOrgName(null);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <SuperAdminShell activeSection="assign-user"><p className={vp.loadingText}>Loading…</p></SuperAdminShell>;
  if (!user?._id) return <SuperAdminShell activeSection="assign-user"><p className={vp.loadingText}>Assignment not found.</p></SuperAdminShell>;
  const displayName = user.name || user.email || '—';

  return (
    <SuperAdminShell activeSection="assign-user">
      <button className={vp.backBtn} onClick={() => router.push('/superadmin/organization-user-assignment')}>
        {BackArrow} Back to User Assignments
      </button>
      <div className={vp.viewToolbar}>
        <nav className={vp.breadcrumb}>
          <button className={vp.breadcrumbLink} onClick={() => router.push('/superadmin/organization-user-assignment')}>User Assignments</button>
          <span className={vp.breadcrumbSep}>›</span>
          <span className={vp.breadcrumbCurr}>{displayName}</span>
        </nav>
        <button className={vp.btnEdit} onClick={() => router.push(`/superadmin/organization-user-assignment/edit/${id}`)}>
          <EditIcon /> Edit
        </button>
      </div>

      <div className={vp.detailCard}>

        <div className={vp.detailBody}>
          <ViewDetailRows s={vp} rows={[
              { label: 'Name', value: user.name },
              { label: 'Email', value: user.email },
              { label: 'WhatsApp No', value: user.whatsapp_no },
              { label: 'Employee ID', value: user.emp_id },
              { label: 'Department', value: user.department },
              { label: 'Designation', value: user.designation },
              { label: 'Organization', value: orgName },
              { label: 'Role', value: capitalize(user.orgRole) },
              { label: 'Status', value: capitalize(user.status) },
              { label: 'Assigned On', value: fmtDate(user.updatedAt || user.createdAt) },
          ]} />
        </div>
      </div>
    </SuperAdminShell>
  );
}
