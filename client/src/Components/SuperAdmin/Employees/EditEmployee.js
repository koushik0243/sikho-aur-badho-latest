'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import LearnerFields, {
  EMPTY_LEARNER, learnerFromUser, learnerPayload, validateLearner, findDuplicateLearnerFields,
} from './LearnerFields';
import sPage from "./EditEmployee.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackArrow = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

export default function EditEmployee() {
  const router = useRouter();
  const { id } = useParams();

  const [form, setForm]         = useState(EMPTY_LEARNER);
  const [loading, setLoading]   = useState(true);
  const [errors, setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [pwReadOnly, setPwReadOnly] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiServiceHandler('GET', `user/admin/edit/${id}?t=${Date.now()}`)
      .then(res => {
        const u = res?.data ?? res;
        if (u) setForm(learnerFromUser(u));
      })
      .catch(() => toast.warning('Failed to load user.'))
      .finally(() => setLoading(false));
  }, [id]);

  function setField(key, val) { setForm(prev => ({ ...prev, [key]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    const errs = validateLearner(form, { passwordRequired: false });
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const dupErrors = await findDuplicateLearnerFields(form, id);
      if (Object.keys(dupErrors).length) { setErrors(dupErrors); return; }

      await apiServiceHandler('PUT', `user/admin/update/${id}`, learnerPayload(form));
      toast.success('User updated successfully.');
      router.push('/superadmin/employees');
    } catch (err) {
      toast.warning(err?.message || 'Failed to update user. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SuperAdminShell activeSection="employees">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/employees')}>
        <BackArrow /> Back to Users
      </button>

      <h1 className={s.pageTitle}>Edit User</h1>
      <p className={s.pageSubtitle}>Update employee account details</p>

      <div className={s.formCard}>
        {loading ? (
          <p style={{ fontSize: 13, color: '#6b7280' }}>Loading…</p>
        ) : (
          <form onSubmit={handleSubmit} autoComplete="off">
            <LearnerFields form={form} setField={setField} errors={errors} s={s} isEdit
              pwReadOnly={pwReadOnly} onPasswordFocus={() => setPwReadOnly(false)} />

            <div className={s.formActions}>
              <button type="submit" className={s.btnSave} disabled={submitting}>
                {submitting ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button" className={s.btnCancel} onClick={() => router.push('/superadmin/employees')}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </SuperAdminShell>
  );
}
