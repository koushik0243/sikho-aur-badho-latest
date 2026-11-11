'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./EditOrgCreditAssignment.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);

export default function EditOrgCreditAssignment() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const orgId = params?.orgId;
  const assignmentId = searchParams.get('assignmentId');

  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState('');
  const [allCredits, setAllCredits] = useState([]);
  const [assignment, setAssignment] = useState(null); // first existing assignment for this org
  const [creditId, setCreditId] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);

    const pCredits  = apiServiceHandler('GET', 'credit/list').catch(() => null);
    const pAssigned = apiServiceHandler('GET', `organization-credit-assignment/list?orgId=${orgId}`).catch(() => null);

    Promise.all([pCredits, pAssigned])
      .then(([creditsRes, assignedRes]) => {
        setAllCredits(Array.isArray(creditsRes?.data) ? creditsRes.data : []);

        const assigned = Array.isArray(assignedRes?.data) ? assignedRes.data : [];
        if (assigned.length > 0) {
          const target = assignmentId
            ? (assigned.find(a => a._id === assignmentId) ?? assigned[0])
            : assigned[0];
          setAssignment(target);
          setOrgName(target.orgId?.org_name || '');
          setCreditId(target.creditId?._id ?? target.creditId ?? '');
        }
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  function validate() {
    const e = {};
    if (!creditId) e.creditId = 'Please select a credit.';
    return e;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      if (assignment?._id) {
        await apiServiceHandler('PUT', `organization-credit-assignment/update/${assignment._id}`, { creditId, status: 'active' });
      } else {
        await apiServiceHandler('POST', 'organization-credit-assignment/create', { orgId, creditId, status: 'active' });
      }
      toast.success('Credit assignment updated successfully.');
      router.push('/superadmin/organization-credit-assignment');
    } catch (err) {
      toast.warning(err?.message || 'Failed to update credit assignment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SuperAdminShell activeSection="assign-credit">
        <p style={{ padding: '40px 0', color: '#6b7280', fontSize: 14 }}>Loading…</p>
      </SuperAdminShell>
    );
  }

  return (
    <SuperAdminShell activeSection="assign-credit">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/organization-credit-assignment')}>
        <BackIcon /> Back
      </button>
      <h1 className={s.pageTitle}>Edit Credit Assignment</h1>
      <p className={s.pageSubtitle}>Update the assigned credit for this organization</p>

      <div className={s.formCard}>
        {/* Org name (read-only) */}
        <div className={s.formGroup}>
          <label>Organization</label>
          <div className={s.orgNameDisplay}>{orgName || '—'}</div>
        </div>

        {/* Credit dropdown */}
        <div className={s.formGroup}>
          <label>Credit *</label>
          {allCredits.length === 0 ? (
            <p style={{ fontSize: 13, color: '#6b7280' }}>No credits available.</p>
          ) : (
            <select value={creditId} onChange={e => setCreditId(e.target.value)}>
              <option value="">— Select credit —</option>
              {allCredits.map(c => {
                const price = c.price?.$numberDecimal ?? c.price;
                const priceLabel = price != null && price !== '' ? ` — $${parseFloat(price).toFixed(2)}` : '';
                return (
                  <option key={c._id} value={c._id}>{c.title}{priceLabel}</option>
                );
              })}
            </select>
          )}
          {errors.creditId && <p className={s.errorMsg}>{errors.creditId}</p>}
        </div>

        <div className={s.formActions}>
          <button className={s.btnPublish} disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            className={s.btnCancel}
            onClick={() => router.push('/superadmin/organization-credit-assignment')}
          >
            Cancel
          </button>
        </div>
      </div>
    </SuperAdminShell>
  );
}
