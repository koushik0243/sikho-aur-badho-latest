'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from './DesignationForm.module.css';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const LIST_PATH = '/superadmin/designations';
const NAME_MAX = 100;

const DeptIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
  </svg>
);

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

/**
 * Add / Edit Designation — one form for both. With `id` it loads that
 * designation and saves an update; without, it creates a new one.
 * @param {{ id?: string }} props
 */
export default function DesignationForm({ id }) {
  const router = useRouter();
  const isEdit = Boolean(id);

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus]           = useState('active');
  const [loading, setLoading]         = useState(isEdit);
  const [loadError, setLoadError]     = useState('');
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    apiServiceHandler('GET', `designation/edit/${id}?t=${Date.now()}`)
      .then(res => {
        if (cancelled) return;
        const row = res?.data ?? res;
        if (!row?._id) { setLoadError('Designation not found.'); return; }
        setName(row.name ?? '');
        setDescription(row.description ?? '');
        setStatus(row.status ?? 'active');
      })
      .catch(() => { if (!cancelled) setLoadError('Failed to load designation.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  function validate() {
    const e = {};
    if (!name.trim()) e.name = 'Designation name is required.';
    else if (name.trim().length > NAME_MAX) e.name = `Designation name must be ${NAME_MAX} characters or fewer.`;
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (submitting) return;
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);
    try {
      // Names are unique — say so on the field instead of a generic failure.
      const qs = new URLSearchParams({ name: name.trim() });
      if (isEdit) qs.set('excludeId', id);
      const dup = await apiServiceHandler('GET', `designation/check?${qs}&t=${Date.now()}`);
      if ((dup?.data ?? null)?._id) {
        setErrors({ name: 'A designation with this name already exists.' });
        return;
      }

      const payload = { name: name.trim(), description: description.trim(), status };
      if (isEdit) await apiServiceHandler('PUT', `designation/update/${id}`, payload);
      else await apiServiceHandler('POST', 'designation/create', payload);
      toast.success(isEdit ? 'Designation updated.' : 'Designation created.');
      router.push(LIST_PATH);
    } catch (err) {
      toast.warning(err?.message || `Failed to ${isEdit ? 'update' : 'create'} designation. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  }

  const header = (
    <>
      <div>
        <button className={s.backBtn} onClick={() => router.push(LIST_PATH)}>
          {BackArrow} Back to Designations
        </button>
      </div>
      <div>
        <h1 className={s.pageTitle}>{isEdit ? 'Edit Designation' : 'Add Designation'}</h1>
        <p className={s.pageSubtitle}>{isEdit ? 'Update the designation details' : 'Create a new designation'}</p>
      </div>
    </>
  );

  if (loading || loadError) {
    return (
      <SuperAdminShell activeSection="manage-designation">
        {header}
        <p className={s.pageSubtitle}>{loadError || 'Loading…'}</p>
      </SuperAdminShell>
    );
  }

  return (
    <SuperAdminShell activeSection="manage-designation">
      {header}

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className={s.card}>
          <div className={s.cardHeader}>{DeptIcon} Designation Information</div>
          <div className={s.cardBody}>
            <div className={s.formGrid}>
              <div className={s.formGroup}>
                <label className={s.label}>Name <span className={s.required}>*</span></label>
                <input
                  className={s.input}
                  type="text"
                  placeholder="e.g. Store Manager"
                  value={name}
                  maxLength={NAME_MAX}
                  onChange={e => setName(e.target.value)}
                  autoComplete="off"
                />
                {errors.name && <span className={s.errorMsg}>{errors.name}</span>}
              </div>
              <div className={s.formGroup}>
                <label className={s.label}>Status</label>
                <select className={s.select} value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className={s.formGroup}>
              <label className={s.label}>Description</label>
              <textarea
                className={s.textarea}
                placeholder="Enter a short description (optional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className={s.actions}>
          <button type="submit" className={s.btnSubmit} disabled={submitting}>
            {submitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create')}
          </button>
          <button type="button" className={s.btnCancel} onClick={() => router.push(LIST_PATH)}>
            Cancel
          </button>
        </div>
      </form>
    </SuperAdminShell>
  );
}
