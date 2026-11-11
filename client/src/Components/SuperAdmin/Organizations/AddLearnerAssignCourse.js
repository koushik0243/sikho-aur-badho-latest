'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler, { clearGetCache } from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from './AddLearnerAssignCourse.module.css';
import PasswordInput from '../../PasswordInput/PasswordInput';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackArrow = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

const BACK_PATH = '/superadmin/organizations';
const EMPTY_FORM = { name: '', email: '', password: '', confirm_password: '', status: 'active' };

const toArr = (res) => (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);

/**
 * SuperAdmin → Organizations → "+ Add Learner & Assign Course".
 * One page, three cards: pick the organization, fill in the learner (saved to
 * the users table as an employee of that org — same as the store owner's Add
 * Learner), and tick the courses to assign. Saving follows the store owner's
 * workflow: create the user → assign each course (course-assignment) → record
 * the 1 learner credit (credit-used). A ticked course that isn't in the org's
 * course library yet is added to it first (organization-course), so the store
 * owner sees it too.
 */
export default function AddLearnerAssignCourse() {
  const router = useRouter();

  const [orgs, setOrgs]       = useState([]);
  const [orgId, setOrgId]     = useState('');
  const [courses, setCourses] = useState([]);           // all published courses
  const [libraryIds, setLibraryIds] = useState(new Set()); // courses already in the org's library
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [form, setForm]     = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [pwReadOnly, setPwReadOnly] = useState(true);
  const [confirmPwReadOnly, setConfirmPwReadOnly] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Organizations + published courses
  useEffect(() => {
    clearGetCache();
    apiServiceHandler('GET', 'organization/list')
      .then(res => setOrgs(toArr(res)))
      .catch(() => setOrgs([]));
    apiServiceHandler('GET', 'course/list?status=published')
      .then(res => setCourses(toArr(res)))
      .catch(() => setCourses([]));
  }, []);

  // The selected org's course library
  useEffect(() => {
    setSelectedIds(new Set());
    if (!orgId) { setLibraryIds(new Set()); return; }
    let cancelled = false;
    setLoadingLibrary(true);
    apiServiceHandler('GET', `organization-course/list?orgId=${orgId}`)
      .then(res => {
        if (cancelled) return;
        setLibraryIds(new Set(toArr(res).map(r => String(r.courseId?._id ?? r.courseId))));
      })
      .catch(() => { if (!cancelled) setLibraryIds(new Set()); })
      .finally(() => { if (!cancelled) setLoadingLibrary(false); });
    return () => { cancelled = true; };
  }, [orgId]);

  function setField(key, val) { setForm(prev => ({ ...prev, [key]: val })); }

  function toggleCourse(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function validate() {
    const e = {};
    if (!orgId) e.orgId = 'Please select an organization.';
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (!form.password) e.password = 'Password is required.';
    else if (form.password.length < 6) e.password = 'Minimum 6 characters.';
    if (!form.confirm_password) e.confirm_password = 'Please confirm password.';
    else if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match.';
    if (selectedIds.size === 0) e.courses = 'Please select at least one course to assign.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);

    let newUserId = null;
    try {
      // Email is unique on the users table — stop before creating anything.
      const dup = await apiServiceHandler('GET', `user/admin/check-exists?email=${encodeURIComponent(form.email.trim())}`);
      if ((dup?.data ?? dup)?.emailExists) {
        setErrors({ email: 'A user with this email already exists.' });
        return;
      }

      // 1 — the learner (employee of the selected organization)
      const createRes = await apiServiceHandler('POST', 'user/admin/create', {
        name:      form.name.trim(),
        email:     form.email.trim(),
        password:  form.password,
        status:    form.status,
        user_type: 'employee',
        orgRole:   'employee',
        orgId,
      });
      newUserId = createRes?.data?._id || createRes?._id;
      if (!newUserId) throw new Error('User creation failed — no ID returned.');

      const picked = courses.filter(c => selectedIds.has(String(c._id)));

      // 2 — courses not yet in the org's library are added to it first
      await Promise.all(picked
        .filter(c => !libraryIds.has(String(c._id)))
        .map(c => apiServiceHandler('POST', 'organization-course/create', { orgId, courseId: c._id, status: 'active' })));

      // 3 — assign every ticked course to the learner against this org
      await Promise.all(picked.map(c =>
        apiServiceHandler('POST', 'course-assignment/create', { organizationId: orgId, userId: newUserId, courseId: c._id })
      ));

      // 4 — adding a learner costs 1 credit (only published courses are listed here)
      await apiServiceHandler('POST', 'credit-used/create', {
        orgId, learnerId: newUserId, courseId: picked[0]._id, status: 'active',
      });

      toast.success(`Learner added and ${picked.length} course${picked.length === 1 ? '' : 's'} assigned.`);
      router.push(BACK_PATH);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Please try again.';
      toast.warning(newUserId
        ? `The learner was created, but assigning courses failed: ${msg}`
        : `Failed to add the learner: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SuperAdminShell activeSection="organizations">
      <button className={s.backBtn} onClick={() => router.push(BACK_PATH)}>
        <BackArrow /> Back to Organizations
      </button>
      <h1 className={s.pageTitle}>Add Learner &amp; Assign Course</h1>
      <p className={s.pageSubtitle}>Create a learner for an organization and assign courses</p>

      <form onSubmit={handleSubmit} autoComplete="off" className={s.stack}>

        {/* 1 — Organization */}
        <div className={s.formCard}>
          <div className={s.formGroup}>
            <label>Organization <span className={s.required}>*</span></label>
            <select value={orgId} onChange={e => setOrgId(e.target.value)}>
              <option value="">— Select organization —</option>
              {orgs.map(org => (
                <option key={org._id} value={org._id}>{org.org_name}</option>
              ))}
            </select>
            {errors.orgId && <p className={s.errorMsg}>{errors.orgId}</p>}
          </div>
        </div>

        {/* 2 — Learner details */}
        <div className={s.formCard}>
          <h2 className={s.sectionTitle}>Learner Details</h2>
          <div className={s.formGrid}>
            <div className={s.formGroup}>
              <label>Name <span className={s.required}>*</span></label>
              <input className={s.input} type="text" placeholder="Full name"
                value={form.name} onChange={e => setField('name', e.target.value)} autoComplete="off" />
              {errors.name && <p className={s.errorMsg}>{errors.name}</p>}
            </div>

            <div className={s.formGroup}>
              <label>Email <span className={s.required}>*</span></label>
              <input className={s.input} type="email" placeholder="user@example.com"
                value={form.email} onChange={e => setField('email', e.target.value)} autoComplete="off" />
              {errors.email && <p className={s.errorMsg}>{errors.email}</p>}
            </div>

            <div className={s.formGroup}>
              <label>Password <span className={s.required}>*</span></label>
              <PasswordInput className={s.input} placeholder="Minimum 6 characters"
                value={form.password} onChange={e => setField('password', e.target.value)}
                autoComplete="new-password" readOnly={pwReadOnly} onFocus={() => setPwReadOnly(false)} />
              {errors.password && <p className={s.errorMsg}>{errors.password}</p>}
            </div>

            <div className={s.formGroup}>
              <label>Confirm Password <span className={s.required}>*</span></label>
              <PasswordInput className={s.input} placeholder="Re-enter password"
                value={form.confirm_password} onChange={e => setField('confirm_password', e.target.value)}
                autoComplete="new-password" readOnly={confirmPwReadOnly} onFocus={() => setConfirmPwReadOnly(false)} />
              {errors.confirm_password && <p className={s.errorMsg}>{errors.confirm_password}</p>}
            </div>

            <div className={s.formGroup}>
              <label>Status</label>
              <select value={form.status} onChange={e => setField('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3 — Courses */}
        <div className={s.formCard}>
          <div className={s.formGroup}>
            <label>Select Courses <span className={s.required}>*</span></label>
            {!orgId ? (
              <p className={s.emptyHint}>Select an organization to choose courses.</p>
            ) : loadingLibrary ? (
              <p className={s.emptyHint}>Loading courses…</p>
            ) : courses.length === 0 ? (
              <p className={s.emptyHint}>No published courses found.</p>
            ) : (
              <div className={s.courseList}>
                {courses.map(c => {
                  const cid = String(c._id);
                  const inLibrary = libraryIds.has(cid);
                  return (
                    <label key={cid} className={s.courseItem}>
                      <input type="checkbox" checked={selectedIds.has(cid)} onChange={() => toggleCourse(cid)} />
                      <span className={s.courseItemTitle}>{c.title}</span>
                      {!inLibrary && (
                        <span className={s.libraryTag} title="This course will also be added to the organization's course library">
                          Will be added to organization
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            {errors.courses && <p className={s.errorMsg}>{errors.courses}</p>}
            {orgId && <p className={s.fieldHint}>Adding a learner uses 1 of the organization&apos;s credits, however many courses are assigned.</p>}
          </div>

          <div className={s.formActions}>
            <button className={s.btnSave} type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Add Learner & Assign Courses'}
            </button>
            <button type="button" className={s.btnCancel} onClick={() => router.push(BACK_PATH)}>
              Cancel
            </button>
          </div>
        </div>

      </form>
    </SuperAdminShell>
  );
}
