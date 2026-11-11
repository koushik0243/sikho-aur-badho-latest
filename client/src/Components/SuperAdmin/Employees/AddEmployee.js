'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import LearnerFields, {
  EMPTY_LEARNER, learnerPayload, validateLearner, findDuplicateLearnerFields,
} from './LearnerFields';
import sPage from "./AddEmployee.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const MAX_USERS = 10;

const BackArrow = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

/** Emails / WhatsApp numbers entered more than once in this batch → field errors per row. */
function findBatchDuplicates(rows) {
  const seen = { email: new Map(), whatsapp_no: new Map() };
  const errs = rows.map(() => ({}));
  rows.forEach(({ form }, i) => {
    for (const key of ['email', 'whatsapp_no']) {
      const val = form[key].trim().toLowerCase();
      if (!val) continue;
      if (seen[key].has(val)) {
        const label = key === 'email' ? 'email' : 'WhatsApp No';
        errs[i][key] = `Same ${label} as User ${seen[key].get(val) + 1}.`;
      } else {
        seen[key].set(val, i);
      }
    }
  });
  return errs;
}

export default function AddEmployee() {
  const router = useRouter();
  const nextId = useRef(1);
  const newRow = () => ({ id: nextId.current++, form: EMPTY_LEARNER, errors: {} });
  const [rows, setRows]             = useState([{ id: 0, form: EMPTY_LEARNER, errors: {} }]);
  const [submitting, setSubmitting] = useState(false);
  const [pwReadOnly, setPwReadOnly] = useState(true);
  const [focusId, setFocusId]       = useState(null);
  // User block waiting for remove confirmation (label kept while the dialog fades out).
  const [confirmRemove, setConfirmRemove] = useState({ show: false, id: null, label: '' });

  // Bring a newly added user block into view and focus its Name field.
  useEffect(() => {
    if (focusId == null) return;
    const block = document.getElementById(`user-block-${focusId}`);
    block?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    block?.querySelector('input')?.focus({ preventScroll: true });
  }, [focusId]);

  function setField(id, key, val) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, form: { ...r.form, [key]: val } } : r)));
  }

  function addUser() {
    if (rows.length >= MAX_USERS) return;
    const row = newRow();
    setRows(prev => [...prev, row]);
    setFocusId(row.id);
  }

  function removeUser(id) {
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : prev));
    setConfirmRemove(c => ({ ...c, show: false }));
  }

  function askRemove(row, i) {
    const name = row.form.name.trim();
    setConfirmRemove({ show: true, id: row.id, label: `User ${i + 1}${name ? ` ("${name}")` : ''}` });
  }

  const withErrors = (list, errs) => list.map((r, i) => ({ ...r, errors: errs[i] }));
  const hasErrors = errs => errs.some(e => Object.keys(e).length);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    const batchDup = findBatchDuplicates(rows);
    const fieldErrs = rows.map((r, i) => ({ ...batchDup[i], ...validateLearner(r.form, { passwordRequired: true }) }));
    if (hasErrors(fieldErrs)) {
      setRows(withErrors(rows, fieldErrs));
      toast.warning('Please fix the highlighted fields.');
      return;
    }

    setSubmitting(true);
    try {
      const dupErrs = await Promise.all(rows.map(r => findDuplicateLearnerFields(r.form)));
      if (hasErrors(dupErrs)) {
        setRows(withErrors(rows, dupErrs));
        toast.warning('Some users already exist. Please fix the highlighted fields.');
        return;
      }

      // Not in any organization yet — assigned later via Assign User.
      const failed = [];
      for (const row of rows) {
        try {
          await apiServiceHandler('POST', 'user/admin/create', {
            ...learnerPayload(row.form),
            user_type: 'employee',
            orgId:     null,
            orgRole:   'employee',
          });
        } catch (err) {
          failed.push({ ...row, errors: { _form: err?.message || 'Failed to create this user.' } });
        }
      }

      const created = rows.length - failed.length;
      if (failed.length === 0) {
        toast.success(created === 1 ? 'User created successfully.' : `${created} users created successfully.`);
        router.push('/superadmin/employees');
        return;
      }
      // Keep only the users that failed so they can be fixed and retried.
      setRows(failed);
      if (created) toast.warning(`${created} of ${rows.length} users created. ${failed.length} failed — please review them.`);
      else toast.warning('Failed to create users. Please try again.');
    } catch (err) {
      toast.warning(err?.message || 'Failed to create user. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const count = rows.length;
  const atMax = count >= MAX_USERS;

  return (
    <SuperAdminShell activeSection="employees">
      <ConfirmModal
        show={confirmRemove.show}
        title="Remove User"
        message={`Remove ${confirmRemove.label} from this form? Any details entered for this user will be lost.`}
        confirmLabel="Remove"
        onConfirm={() => removeUser(confirmRemove.id)}
        onCancel={() => setConfirmRemove(c => ({ ...c, show: false }))}
      />
      <button className={s.backBtn} onClick={() => router.push('/superadmin/employees')}>
        <BackArrow /> Back to Users
      </button>

      <h1 className={s.pageTitle}>Add User</h1>
      <p className={s.pageSubtitle}>Create new employee accounts — up to {MAX_USERS} at a time</p>

      <form className={s.formCard} onSubmit={handleSubmit} autoComplete="off" noValidate>
        {rows.map((row, i) => (
          <section key={row.id} id={`user-block-${row.id}`} className={s.userBlock} aria-labelledby={`user-h-${row.id}`}>
            <div className={s.userBlockHead}>
              <h2 id={`user-h-${row.id}`} className={s.userBlockTitle}>
                <span className={s.userBadge}>{i + 1}</span>
                User {i + 1}
                {row.form.name.trim() && <span className={s.userBlockName}>— {row.form.name.trim()}</span>}
              </h2>
              {count > 1 && (
                <button type="button" className={s.btnRemove} onClick={() => askRemove(row, i)}
                  disabled={submitting} aria-label={`Remove user ${i + 1}`}>
                  <TrashIcon /> Remove
                </button>
              )}
            </div>
            {row.errors._form && <p className={s.blockError} role="alert">{row.errors._form}</p>}
            <LearnerFields form={row.form} setField={(k, v) => setField(row.id, k, v)} errors={row.errors} s={s}
              pwReadOnly={pwReadOnly} onPasswordFocus={() => setPwReadOnly(false)} />
          </section>
        ))}

        <div className={s.addMoreRow}>
          <button type="button" className={s.btnAddMore} onClick={addUser} disabled={atMax || submitting}>
            <PlusIcon /> Add More
          </button>
          <span className={s.addMoreHint} aria-live="polite">
            {atMax ? `Maximum of ${MAX_USERS} users reached` : `${count} of ${MAX_USERS} users`}
          </span>
        </div>

        <div className={s.formActions}>
          <button type="submit" className={s.btnSave} disabled={submitting}>
            {submitting ? 'Creating…' : count === 1 ? 'Create User' : `Create ${count} Users`}
          </button>
          <button type="button" className={s.btnCancel} onClick={() => router.push('/superadmin/employees')}>
            Cancel
          </button>
        </div>
      </form>
    </SuperAdminShell>
  );
}
