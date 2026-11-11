'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./ViewOrgCreditAssignment.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';
import { orDash } from '../../../lib/displayValue';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackArrow = () => (
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
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function fmtPrice(val) {
  if (val === null || val === undefined) return '—';
  const num = parseFloat(val?.$numberDecimal ?? val);
  if (isNaN(num)) return '—';
  return num.toFixed(2);
}

export default function ViewOrgCreditAssignment() {
  const router    = useRouter();
  const { orgId } = useParams();
  const [orgName, setOrgName] = useState('');
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    apiServiceHandler('GET', 'organization-credit-assignment/list')
      .then(res => {
        const all = Array.isArray(res?.data) ? res.data : [];
        const forOrg = all.filter(r => {
          const id = r.orgId?._id ?? r.orgId;
          return String(id) === String(orgId);
        });
        if (forOrg.length) {
          setOrgName(forOrg[0].orgId?.org_name || '—');
          setCredits(forOrg.map(r => ({
            id:         r._id,
            title:      r.creditId?.title || '—',
            limitFrom:  orDash(r.creditId?.limit_from),
            limitTo:    orDash(r.creditId?.limit_to),
            price:      fmtPrice(r.creditId?.price),
            status:     r.status,
            createdAt:  r.createdAt,
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  if (loading) return <SuperAdminShell activeSection="assign-credit"><p style={{ padding: 40, color: '#6b7280' }}>Loading…</p></SuperAdminShell>;

  return (
    <SuperAdminShell activeSection="assign-credit">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/organization-credit-assignment')}>
        <BackArrow /> Back to Credit Assignments
      </button>

      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>{orgName || 'Organization'}</h1>
          <p className={s.pageSubtitle}>Credit assignment details</p>
        </div>
        <button className={s.btnEditView} onClick={() => router.push(`/superadmin/organization-credit-assignment/${orgId}`)}>
          <EditIcon /> Manage Assignments
        </button>
      </div>

      <div className={s.viewCard}>
        <div className={s.viewRow} style={{ marginBottom: 16 }}>
          <div className={s.viewLabel}>Organization</div>
          <div className={s.viewValue}>{orgName || '—'}</div>
        </div>

        <div className={s.viewLabel} style={{ marginBottom: 8 }}>
          Assigned Credits ({credits.length})
        </div>
        {credits.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13 }}>No credits assigned.</p>
        ) : (
          <table className={s.table} style={{ marginTop: 0 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Plan</th>
                <th>Range</th>
                <th>Price</th>
                <th>Status</th>
                <th>Assigned On</th>
              </tr>
            </thead>
            <tbody>
              {credits.map((c, i) => (
                <tr key={c.id}>
                  <td>{i + 1}</td>
                  <td>{c.title}</td>
                  <td>{c.limitFrom} – {c.limitTo}</td>
                  <td>{c.price}</td>
                  <td>
                    {c.status === 'active'
                      ? <span className={s.badgeActive}>Active</span>
                      : <span className={s.badgeInactive}>Inactive</span>}
                  </td>
                  <td>{fmtDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </SuperAdminShell>
  );
}
