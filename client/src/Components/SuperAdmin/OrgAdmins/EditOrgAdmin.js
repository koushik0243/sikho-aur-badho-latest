'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./EditOrgAdmin.module.css";
import PasswordInput from '../../PasswordInput/PasswordInput';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackArrow = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

export default function EditOrgAdmin() {
  const router      = useRouter();
  const params      = useParams();
  const searchParams = useSearchParams();
  const adminId     = params?.adminId;
  const orgId       = searchParams.get('orgId') || '';

  const [form, setForm]             = useState({ name: '', email: '', password: '', confirm_password: '', user_role: '', status: 'active' });
  const [roles, setRoles]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [pwReadOnly, setPwReadOnly] = useState(true);
  const [confirmPwReadOnly, setConfirmPwReadOnly] = useState(true);

  useEffect(() => {
    if (!adminId) return;
    Promise.all([
      apiServiceHandler('GET', `user/admin/edit/${adminId}`).catch(() => null),
      apiServiceHandler('GET', `role/list?user_type=organization${orgId ? `&orgId=${orgId}` : ''}`).catch(() => null),
    ]).then(([userRes, rolesRes]) => {
      const u = userRes?.data ?? userRes;
      if (u?._id) {
        setForm({
          name:             u.name ?? '',
          email:            u.email ?? '',
          password:         '',
          confirm_password: '',
          user_role:        u.user_role ? String(u.user_role?._id ?? u.user_role) : '',
          status:           u.status ?? 'active',
        });
      }
      setRoles(Array.isArray(rolesRes?.data) ? rolesRes.data : []);
    }).finally(() => setLoading(false));
  }, [adminId]);

  function setField(key, val) { setForm(prev => ({ ...prev, [key]: val })); }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.email.trim()) {
      e.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      e.email = 'Enter a valid email address.';
    }
    if (form.password) {
      if (form.password.length < 6) e.password = 'Password must be at least 6 characters.';
      if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match.';
    }
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const payload = {
        name:      form.name.trim(),
        email:     form.email.trim(),
        status:    form.status,
        user_role: form.user_role || null,
        user_type: 'organization',
        orgId:     orgId || null,
        orgRole:   'admin',
      };
      if (form.password) payload.password = form.password;
      await apiServiceHandler('PUT', `user/admin/update/${adminId}`, payload);
      toast.success('Admin updated successfully.');
      router.push(`/superadmin/organization-admins${orgId ? `?orgId=${orgId}` : ''}`);
    } catch (err) {
      toast.warning(err?.message || 'Failed to update admin. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const backUrl = `/superadmin/organization-admins${orgId ? `?orgId=${orgId}` : ''}`;

  if (loading) {
    return (
      <SuperAdminShell activeSection="organizations">
        <p style={{ padding: '40px 0', color: '#6b7280', fontSize: 14 }}>Loading…</p>
      </SuperAdminShell>
    );
  }

  return (
    <SuperAdminShell activeSection="organizations">
      <button className={s.backBtn} onClick={() => router.push(backUrl)}>
        <BackArrow /> Back to Admins
      </button>
      <h1 className={s.pageTitle}>Edit Admin</h1>
      <p className={s.pageSubtitle}>Update administrator details</p>

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className={s.formCard}>
          <div className={s.formGrid}>

            {/* Name */}
            <div className={s.formGroup}>
              <label>Name <span className={s.required}>*</span></label>
              <input
                className={s.input}
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                autoComplete="off"
              />
              {errors.name && <p className={s.errorMsg}>{errors.name}</p>}
            </div>

            {/* Email */}
            <div className={s.formGroup}>
              <label>Email <span className={s.required}>*</span></label>
              <input
                className={s.input}
                type="email"
                placeholder="user@example.com"
                value={form.email}
                onChange={e => setField('email', e.target.value)}
                autoComplete="off"
              />
              {errors.email && <p className={s.errorMsg}>{errors.email}</p>}
            </div>

            {/* Password (optional) */}
            <div className={s.formGroup}>
              <label>Password <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 11.5 }}>(leave blank to keep current)</span></label>
              <PasswordInput
                className={s.input}
                placeholder="New password"
                value={form.password}
                onChange={e => setField('password', e.target.value)}
                autoComplete="new-password"
                readOnly={pwReadOnly}
                onFocus={() => setPwReadOnly(false)}
              />
              {errors.password && <p className={s.errorMsg}>{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className={s.formGroup}>
              <label>Confirm Password</label>
              <PasswordInput
                className={s.input}
                placeholder="Re-enter new password"
                value={form.confirm_password}
                onChange={e => setField('confirm_password', e.target.value)}
                autoComplete="new-password"
                readOnly={confirmPwReadOnly}
                onFocus={() => setConfirmPwReadOnly(false)}
              />
              {errors.confirm_password && <p className={s.errorMsg}>{errors.confirm_password}</p>}
            </div>

            {/* Role */}
            <div className={s.formGroup}>
              <label>Role</label>
              <select
                className={s.select}
                value={form.user_role}
                onChange={e => setField('user_role', e.target.value)}
              >
                <option value="">— Select role —</option>
                {roles.map(r => (
                  <option key={r._id} value={String(r._id)}>{r.display_name || r.name}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className={s.formGroup}>
              <label>Status</label>
              <select
                className={s.select}
                value={form.status}
                onChange={e => setField('status', e.target.value)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Actions */}
            <div className={`${s.formActions} ${s.formGroupFull}`}>
              <button className={s.btnSave} type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                type="button"
                className={s.btnCancel}
                onClick={() => router.push(backUrl)}
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      </form>
    </SuperAdminShell>
  );
}
