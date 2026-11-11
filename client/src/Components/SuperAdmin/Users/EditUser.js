'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./EditUser.module.css";
import PasswordInput from '../../PasswordInput/PasswordInput';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackArrow = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

export default function EditUser() {
  const router = useRouter();
  const { id } = useParams();
  const [form, setForm]         = useState({ name: '', email: '', password: '', confirm_password: '', user_role: '', status: 'active' });
  const [roles, setRoles]       = useState([]);
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pwReadOnly, setPwReadOnly] = useState(true);
  const [confirmPwReadOnly, setConfirmPwReadOnly] = useState(true);

  useEffect(() => {
    apiServiceHandler('GET', 'role/list-pagination?limit=200&page=1&user_type=superadmin')
      .then(res => setRoles(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    if (!id) return;
    apiServiceHandler('GET', `user/admin/edit/${id}`)
      .then(res => {
        const u = res?.data ?? res;
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
      })
      .catch(() => toast.warning('Failed to load user.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function setField(key, val) { setForm(prev => ({ ...prev, [key]: val })); }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (form.password) {
      if (form.password.length < 6) e.password = 'Minimum 6 characters.';
      else if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match.';
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
        user_type: 'superadmin',
      };
      if (form.password) payload.password = form.password;
      await apiServiceHandler('PUT', `user/admin/update/${id}`, payload);
      toast.success('User updated successfully.');
      router.push('/superadmin/user');
    } catch (err) {
      toast.warning(err?.message || 'Failed to update user.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <SuperAdminShell activeSection="users"><p style={{ padding: 40, color: '#6b7280' }}>Loading…</p></SuperAdminShell>;
  }

  return (
    <SuperAdminShell activeSection="users">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/user')}>
        <BackArrow /> Back to Users
      </button>
      <h1 className={s.pageTitle}>Edit User</h1>
      <p className={s.pageSubtitle}>Update super admin user details</p>

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className={s.formCard}>
          <div className={s.formGrid}>

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

            <div className={s.formGroup}>
              <label>Password</label>
              <PasswordInput
                className={s.input}
                placeholder="Leave blank to keep current password"
                value={form.password}
                onChange={e => setField('password', e.target.value)}
                autoComplete="new-password"
                readOnly={pwReadOnly}
                onFocus={() => setPwReadOnly(false)}
              />
              {errors.password && <p className={s.errorMsg}>{errors.password}</p>}
            </div>

            <div className={s.formGroup}>
              <label>Confirm Password</label>
              <PasswordInput
                className={s.input}
                placeholder="Re-enter password"
                value={form.confirm_password}
                onChange={e => setField('confirm_password', e.target.value)}
                autoComplete="new-password"
                readOnly={confirmPwReadOnly}
                onFocus={() => setConfirmPwReadOnly(false)}
              />
              {errors.confirm_password && <p className={s.errorMsg}>{errors.confirm_password}</p>}
            </div>

            {/* Role (left) + Status (right) */}
            <div className={s.formGroup}>
              <label>Role</label>
              <select className={s.select} value={form.user_role} onChange={e => setField('user_role', e.target.value)}>
                <option value="">— Select role —</option>
                {roles.map(r => (
                  <option key={r._id} value={String(r._id)}>{r.display_name || r.name}</option>
                ))}
              </select>
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
                {submitting ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button" className={s.btnCancel} onClick={() => router.push('/superadmin/user')}>
                Cancel
              </button>
            </div>

          </div>
        </div>
      </form>
    </SuperAdminShell>
  );
}
