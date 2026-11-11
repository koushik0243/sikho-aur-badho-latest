'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./AddRole.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackArrow = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

const EMPTY = { name: '', display_name: '', desc: '', status: 'active', user_type: 'superadmin', organizationId: '' };

export default function AddRole() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [orgs, setOrgs] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiServiceHandler('GET', 'organization/list-pagination?limit=1000')
      .then(res => setOrgs(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  function setField(key, val) { setForm(prev => ({ ...prev, [key]: val })); }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.display_name.trim()) e.display_name = 'Display name is required.';
    if (form.user_type === 'organization' && !form.organizationId) e.organizationId = 'Organization is required.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await apiServiceHandler('POST', 'role/create', {
        name:           form.name.trim(),
        display_name:   form.display_name.trim(),
        desc:           form.desc.trim() || '',
        status:         form.status,
        user_type:      form.user_type,
        organizationId: form.user_type === 'organization' ? (form.organizationId || null) : null,
      });
      toast.success('Role created successfully.');
      router.push('/superadmin/roles');
    } catch (err) {
      toast.warning(err?.message || 'Failed to create role.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SuperAdminShell activeSection="roles">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/roles')}>
        <BackArrow /> Back to Roles
      </button>
      <h1 className={s.pageTitle}>Add Role</h1>
      <p className={s.pageSubtitle}>Create a new system role</p>

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className={s.formCard}>
          <div className={s.formGrid}>

            <div className={`${s.formGroup} ${s.formGroupFull}`}>
              <label>Name <span className={s.required}>*</span></label>
              <input
                className={s.input}
                type="text"
                placeholder="e.g. admin"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                autoComplete="off"
              />
              {errors.name && <p className={s.errorMsg}>{errors.name}</p>}
              <p className={s.hintMsg}>Small letter with underscore ( _ ) separated</p>
            </div>

            <div className={`${s.formGroup} ${s.formGroupFull}`}>
              <label>Display Name <span className={s.required}>*</span></label>
              <input
                className={s.input}
                type="text"
                placeholder="e.g. Administrator"
                value={form.display_name}
                onChange={e => setField('display_name', e.target.value)}
                autoComplete="off"
              />
              {errors.display_name && <p className={s.errorMsg}>{errors.display_name}</p>}
              <p className={s.hintMsg}>A name that can be easily Identified</p>
            </div>

            <div className={s.formGroup}>
              <label>User Type <span className={s.required}>*</span></label>
              <select
                className={s.select}
                value={form.user_type}
                onChange={e => setField('user_type', e.target.value)}
              >
                <option value="superadmin">Super Admin</option>
                <option value="organization">Organization</option>
              </select>
            </div>

            {form.user_type === 'organization' && (
              <div className={s.formGroup}>
                <label>Organization <span className={s.required}>*</span></label>
                <select
                  className={s.select}
                  value={form.organizationId}
                  onChange={e => setField('organizationId', e.target.value)}
                >
                  <option value="">— Select organization —</option>
                  {orgs.map(o => (
                    <option key={o._id} value={o._id}>{o.org_name}</option>
                  ))}
                </select>
                {errors.organizationId && <p className={s.errorMsg}>{errors.organizationId}</p>}
              </div>
            )}

            <div className={s.formGroup}>
              <label>Status</label>
              <select className={s.select} value={form.status} onChange={e => setField('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className={s.formActions}>
              <button className={s.btnSave} type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save Role'}
              </button>
              <button type="button" className={s.btnCancel} onClick={() => router.push('/superadmin/roles')}>
                Cancel
              </button>
            </div>

          </div>
        </div>
      </form>
    </SuperAdminShell>
  );
}
