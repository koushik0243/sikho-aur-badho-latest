'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./AddPermission.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackArrow = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

const EMPTY = { name: '', display_name: '', status: 'active' };

export default function AddPermission() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function setField(key, val) { setForm(prev => ({ ...prev, [key]: val })); }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.display_name.trim()) e.display_name = 'Display name is required.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await apiServiceHandler('POST', 'permission/create', {
        name:         form.name.trim(),
        display_name: form.display_name.trim(),
        status:       form.status,
      });
      toast.success('Permission created successfully.');
      router.push('/superadmin/permissions');
    } catch (err) {
      toast.warning(err?.message || 'Failed to create permission.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SuperAdminShell activeSection="permissions">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/permissions')}>
        <BackArrow /> Back to Permissions
      </button>
      <h1 className={s.pageTitle}>Add Permission</h1>
      <p className={s.pageSubtitle}>Create a new system permission</p>

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className={s.formCard}>
          <div className={s.formGrid}>

            <div className={`${s.formGroup} ${s.formGroupFull}`}>
              <label>Name <span className={s.required}>*</span></label>
              <input
                className={s.input}
                type="text"
                placeholder="e.g. add_courses"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                autoComplete="off"
              />
              {errors.name && <p className={s.errorMsg}>{errors.name}</p>}
            </div>

            <div className={`${s.formGroup} ${s.formGroupFull}`}>
              <label>Display Name <span className={s.required}>*</span></label>
              <input
                className={s.input}
                type="text"
                placeholder="e.g. Add Courses"
                value={form.display_name}
                onChange={e => setField('display_name', e.target.value)}
                autoComplete="off"
              />
              {errors.display_name && <p className={s.errorMsg}>{errors.display_name}</p>}
            </div>

            <div className={s.formGroup}>
              <label>Status</label>
              <select className={s.select} value={form.status} onChange={e => setField('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className={s.formActions}>
              <button className={s.btnSave} type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save Permission'}
              </button>
              <button type="button" className={s.btnCancel} onClick={() => router.push('/superadmin/permissions')}>
                Cancel
              </button>
            </div>

          </div>
        </div>
      </form>
    </SuperAdminShell>
  );
}
