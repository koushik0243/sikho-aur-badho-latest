'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./AddOrgCreditAssignment.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);

export default function AddOrgCreditAssignment() {
  const router = useRouter();
  const [orgs, setOrgs]       = useState([]);
  const [credits, setCredits] = useState([]);
  const [orgId, setOrgId]     = useState('');
  const [creditId, setCreditId] = useState('');
  const [errors, setErrors]   = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiServiceHandler('GET', 'organization/list')
      .then(res => setOrgs(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
    apiServiceHandler('GET', 'credit/list')
      .then(res => setCredits(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  function validate() {
    const e = {};
    if (!orgId)    e.orgId    = 'Please select an organization.';
    if (!creditId) e.creditId = 'Please select a credit.';
    return e;
  }

  // Assign Credit -> the assignment is created directly server-side (see
  // server/organization_credit_assignment/organization_credit_assignment.service.js).
  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);

    try {
      await apiServiceHandler('POST', 'organization-credit-assignment/create', { orgId, creditId });
      toast.success('Credit assigned successfully.');
      router.push('/superadmin/organization-credit-assignment');
    } catch (err) {
      toast.warning(err?.message || 'Could not assign credit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SuperAdminShell activeSection="assign-credit">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/organization-credit-assignment')}>
        <BackIcon /> Back
      </button>
      <h1 className={s.pageTitle}>Add Credit Assignment</h1>
      <p className={s.pageSubtitle}>Select an organization and assign a credit plan to it</p>

      <div className={s.formCard}>
        <div className={s.formGroup}>
          <label>Organization *</label>
          <select value={orgId} onChange={e => { setOrgId(e.target.value); setCreditId(''); }}>
            <option value="">— Select organization —</option>
            {orgs.map(org => (
              <option key={org._id} value={org._id}>{org.org_name}</option>
            ))}
          </select>
          {errors.orgId && <p className={s.errorMsg}>{errors.orgId}</p>}
        </div>

        {orgId && (
          <div className={s.formGroup}>
            <label>Credit *</label>
            <select value={creditId} onChange={e => setCreditId(e.target.value)}>
              <option value="">— Select credit —</option>
              {credits.map(c => {
                const price = c.price?.$numberDecimal ?? c.price;
                const priceLabel = price != null && price !== '' ? ` — ₹${parseFloat(price).toFixed(2)}` : '';
                return (
                  <option key={c._id} value={c._id}>{c.title}{priceLabel}</option>
                );
              })}
            </select>
            {errors.creditId && <p className={s.errorMsg}>{errors.creditId}</p>}
          </div>
        )}

        <div className={s.formActions}>
          <button className={s.btnPublish} disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Processing…' : 'Assign Credit'}
          </button>
          <button className={s.btnCancel} onClick={() => router.push('/superadmin/organization-credit-assignment')}>
            Cancel
          </button>
        </div>
      </div>
    </SuperAdminShell>
  );
}
