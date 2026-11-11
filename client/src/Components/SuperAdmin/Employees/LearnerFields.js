'use client';

import apiServiceHandler from '../../../service/apiService';
import useDepartments from '../../../hooks/useDepartments';
import useDesignations from '../../../hooks/useDesignations';
import PasswordInput from '../../PasswordInput/PasswordInput';

// Learner details — the same fields, labels and hints as the store owner's
// Add Learner form, shared by SuperAdmin → User → Add / Edit.

export const LANGUAGES = ['English', 'Hindi'];

export const EMPTY_LEARNER = {
  name: '', email: '', whatsapp_no: '',
  employeeId: '', department: '', designation: '',
  language: '',
  password: '', confirmPassword: '', accountStatus: 'active',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 6;

/** User record → form values. */
export function learnerFromUser(u) {
  return {
    name:            u?.name ?? '',
    email:           u?.email ?? '',
    whatsapp_no:     u?.whatsapp_no ?? '',
    employeeId:      u?.emp_id ?? '',
    department:      u?.department ?? '',
    designation:     u?.designation ?? '',
    language:        u?.course_language ?? '',
    password:        '',
    confirmPassword: '',
    accountStatus:   u?.status ?? 'active',
  };
}

/** Form values → users table fields (password only when one was entered). */
export function learnerPayload(form) {
  const payload = {
    name:            form.name.trim(),
    email:           form.email.trim(),
    whatsapp_no:     form.whatsapp_no.trim(),
    emp_id:          form.employeeId.trim(),
    department:      form.department,
    designation:     form.designation.trim(),
    course_language: form.language,
    status:          form.accountStatus,
  };
  if (form.password) payload.password = form.password;
  return payload;
}

/** @param {{ passwordRequired: boolean }} opts — required on Add, optional on Edit */
export function validateLearner(form, { passwordRequired }) {
  const e = {};
  if (!form.name.trim()) e.name = 'Name is required.';
  if (!form.email.trim()) e.email = 'Email is required.';
  else if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email address.';
  if (!form.whatsapp_no.trim()) e.whatsapp_no = 'WhatsApp No is required.';
  if (passwordRequired && !form.password) e.password = 'Temporary password is required.';
  else if (form.password && form.password.length < PASSWORD_MIN) e.password = `Minimum ${PASSWORD_MIN} characters.`;
  if (form.password || passwordRequired) {
    if (!form.confirmPassword) e.confirmPassword = 'Please confirm the password.';
    else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
  }
  return e;
}

/**
 * Email and WhatsApp No are unique on the users table — returns field errors
 * for any that are already taken (excluding `excludeUserId` when editing).
 */
export async function findDuplicateLearnerFields(form, excludeUserId) {
  const params = new URLSearchParams({ email: form.email.trim(), whatsapp_no: form.whatsapp_no.trim() });
  if (excludeUserId) params.set('excludeUserId', excludeUserId);
  params.set('t', String(Date.now()));
  const res = await apiServiceHandler('GET', `user/admin/check-exists?${params}`);
  const { emailExists, whatsappExists } = res?.data ?? res ?? {};
  const e = {};
  if (emailExists) e.email = 'A user with this email already exists.';
  if (whatsappExists) e.whatsapp_no = 'A user with this WhatsApp No already exists.';
  return e;
}

/**
 * @param {{
 *   form: typeof EMPTY_LEARNER,
 *   setField: (key: string, value: string) => void,
 *   errors: Record<string, string>,
 *   s: Record<string, string>,          // the page's CSS module
 *   isEdit?: boolean,
 *   pwReadOnly: boolean,                 // blocks browser autofill until focused
 *   onPasswordFocus: () => void,
 * }} props
 */
export default function LearnerFields({ form, setField, errors, s, isEdit = false, pwReadOnly, onPasswordFocus }) {
  const { departments, loading: departmentsLoading } = useDepartments(form.department);
  const { designations, loading: designationsLoading } = useDesignations(form.designation);
  const bind = key => ({ value: form[key], onChange: e => setField(key, e.target.value) });

  return (
    <div className={s.formGrid}>
      <div className={s.formGroup}>
        <label>Name <span className={s.required}>*</span></label>
        <input className={s.input} type="text" placeholder="e.g. Kavita" autoComplete="off" {...bind('name')} />
        {errors.name && <p className={s.errorMsg}>{errors.name}</p>}
      </div>

      <div className={s.formGroup}>
        <label>Email Address <span className={s.required}>*</span></label>
        <input className={s.input} type="email" placeholder="Enter email address…" autoComplete="off" {...bind('email')} />
        {errors.email ? <p className={s.errorMsg}>{errors.email}</p>
          : <p className={s.fieldHint}>Used for login and email notifications</p>}
      </div>

      <div className={s.formGroup}>
        <label>WhatsApp No <span className={s.required}>*</span></label>
        <input className={s.input} type="tel" placeholder="e.g. +91 98765 43210" autoComplete="off" {...bind('whatsapp_no')} />
        {errors.whatsapp_no ? <p className={s.errorMsg}>{errors.whatsapp_no}</p>
          : <p className={s.fieldHint}>Used for course reminders and alerts</p>}
      </div>

      <div className={s.formGroup}>
        <label>Employee ID</label>
        <input className={s.input} type="text" placeholder="WK-0123456" autoComplete="off" {...bind('employeeId')} />
      </div>

      <div className={s.formGroup}>
        <label>Department</label>
        <select className={s.select} disabled={departmentsLoading} {...bind('department')}>
          <option value="">{departmentsLoading ? 'Loading departments…' : 'Select Department'}</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className={s.formGroup}>
        <label>Designation</label>
        <select className={s.select} disabled={designationsLoading} {...bind('designation')}>
          <option value="">{designationsLoading ? 'Loading designations…' : 'Select Designation'}</option>
          {designations.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className={s.formGroup}>
        <label>Language Preference</label>
        <select className={s.select} {...bind('language')}>
          <option value="">Select Language</option>
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>


      <div className={s.formGroup}>
        <label>Account Status</label>
        <select className={s.select} {...bind('accountStatus')}>
          <option value="active">Active – Can log in Immediately</option>
          <option value="inactive">Inactive – Cannot log in</option>
        </select>
      </div>

      <div className={s.formGroup}>
        <label>
          {isEdit ? 'New Password' : 'Temporary Password'}{' '}
          {isEdit
            ? <span className={s.optionalTag}>(optional)</span>
            : <span className={s.required}>*</span>}
        </label>
        <PasswordInput
          className={s.input}
          placeholder={isEdit ? 'Leave blank to keep current' : 'Password'}
          autoComplete="new-password"
          readOnly={pwReadOnly}
          onFocus={onPasswordFocus}
          {...bind('password')}
        />
        {errors.password ? <p className={s.errorMsg}>{errors.password}</p>
          : isEdit && <p className={s.fieldHint}>Only fill this in to change the password</p>}
      </div>

      <div className={s.formGroup}>
        <label>
          {isEdit ? 'Confirm New Password' : 'Temporary Confirm Password'}{' '}
          {isEdit
            ? <span className={s.optionalTag}>(only if changing)</span>
            : <span className={s.required}>*</span>}
        </label>
        <PasswordInput
          className={s.input}
          placeholder={isEdit ? 'Re-enter the new password' : 'Re-enter the password'}
          autoComplete="new-password"
          readOnly={pwReadOnly}
          onFocus={onPasswordFocus}
          {...bind('confirmPassword')}
        />
        {errors.confirmPassword && <p className={s.errorMsg}>{errors.confirmPassword}</p>}
      </div>
    </div>
  );
}
