'use client';

import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { selectUser } from '../../../redux/slices/authSlice';
import useDepartments from '../../../hooks/useDepartments';
import useDesignations from '../../../hooks/useDesignations';
import apiServiceHandler, { clearGetCache } from '../../../service/apiService';
import { toast } from 'sonner';
import PasswordInput from '../../PasswordInput/PasswordInput';
import pageStyles from "./AddLearner.module.css";
import { withFormKit } from '../PageKit/PageKit';
import { orDash } from '../../../lib/displayValue';

// Page styles + the shared store owner form look.
const s = withFormKit(pageStyles);

// ── Icons ────────────────────────────────────────────────────────
const Icon = {
  users:        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zM6.865 14c.41-1.135 1.53-2 2.635-2h1c1.105 0 2.226.865 2.635 2H6.865zM1 14a5.002 5.002 0 019-3h.001A5 5 0 0119 14v1H1v-1z" /></svg>,
  chevronDown:  <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>,
  arrowLeft:    <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>,
  arrowRight:   <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>,
  credit:       <svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>,
  check:        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>,
};

const STEPS = [
  { num: '01', label: 'Learner Details' },
  { num: '02', label: 'Assign Courses' },
  { num: '03', label: 'Notification & Confirm' },
];

const LANGUAGES   = ['English', 'Hindi'];

const EMPTY_FORM = {
  firstName: '', lastName: '',
  email: '', whatsapp_no: '',
  employeeId: '', department: '',
  designation: '', language: '',
  tempPassword: '', confirmTempPassword: '', accountStatus: 'active',
};



export default function AddLearnerPage() {
  const user = useSelector(selectUser);
  const router = useRouter();

  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  // Department options come from SuperAdmin → Manage Department.
  const { departments, loading: departmentsLoading } = useDepartments(form.department);
  // Designation options come from SuperAdmin → Manage Designation.
  const { designations, loading: designationsLoading } = useDesignations(form.designation);
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [checkingDup, setCheckingDup] = useState(false);
  const [notifyPrefs, setNotifyPrefs] = useState({ email: true, alert: true, digest: false });

  const [allOrgCredits, setAllOrgCredits] = useState([]);
  const [orgEmpCount, setOrgEmpCount]     = useState(null);
  const [assignedCount, setAssignedCount] = useState(0);
  const [resolvedOrgId, setResolvedOrgId] = useState(null);

  const userId = user?._id ? String(user._id) : null;

  // Decode JWT from localStorage — fallback for page-refresh when Redux is empty
  function getTokenUserId() {
    if (typeof window === 'undefined') return null;
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload._id || null;
    } catch { return null; }
  }

  // Avoid serving a stale cached course/status list — this page's credit math
  // depends on each course's up-to-the-minute published/draft state.
  useEffect(() => { clearGetCache(); }, []);

  useEffect(() => {
    const effectiveUserId = userId || getTokenUserId();
    if (!effectiveUserId) return;

    // orgId may already be on the user record (users.orgId = organizations._id)
    const reduxOrgId = user?.orgId ? String(user.orgId?._id ?? user.orgId) : null;

    const loadCourses = (orgId) => {
      setCoursesLoading(true);
      apiServiceHandler('GET', `organization-course/list?orgId=${orgId}&status=active`)
        .then(res => {
          const list = Array.isArray(res?.data) ? res.data : [];
          // Only published courses are offered here — a course can be unpublished
          // back to draft after being added to the org's library, so a draft one
          // has nothing ready for a learner to study and shouldn't be assignable.
          setCourses(
            list
              .filter(item => (item.courseId?.status || 'draft') === 'published')
              .map(item => ({
                id: item.courseId?._id || String(item.courseId),
                name: item.courseId?.title || 'Untitled',
                status: item.courseId?.status,
                meta: '',
              }))
          );
        })
        .catch(() => setCourses([]))
        .finally(() => setCoursesLoading(false));

      // Snapshot data in parallel
      Promise.all([
        apiServiceHandler('GET', `organization-credit-assignment/list?orgId=${orgId}`),
        apiServiceHandler('GET', `user/admin/list?orgId=${orgId}&user_type=employee&orgRole=employee`),
        apiServiceHandler('GET', `credit-used/list?orgId=${orgId}`),
      ]).then(([creditRes, learnersRes, usedRes]) => {
        const credits = Array.isArray(creditRes?.data) ? creditRes.data : [];
        credits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setAllOrgCredits(credits);
        const learners = Array.isArray(learnersRes?.data) ? learnersRes.data : [];
        setOrgEmpCount(learners.length);
        // Same source of truth as the Credits page — count active credit-used
        // records (one per course assignment), not unique learners, so every
        // course assigned (not just a learner's first) counts against the balance.
        const used = Array.isArray(usedRes?.data) ? usedRes.data
          : Array.isArray(usedRes) ? usedRes : [];
        setAssignedCount(used.filter(u => (u.status || 'active') === 'active').length);
      }).catch(() => {});
    };

    if (reduxOrgId) {
      // Fast path: orgId already on user record
      setResolvedOrgId(reduxOrgId);
      loadCourses(reduxOrgId);
    } else {
      // Fallback: look up org where ownerId = user._id
      apiServiceHandler('GET', `organization/list?ownerId=${effectiveUserId}`)
        .then(orgRes => {
          const orgs = Array.isArray(orgRes?.data) ? orgRes.data : [];
          const orgId = orgs[0] ? String(orgs[0]._id) : null;
          if (!orgId) return;
          setResolvedOrgId(orgId);
          loadCourses(orgId);
        })
        .catch(() => setCoursesLoading(false));
    }
  }, [userId]);

  // Derived credit values — same calculation as Credits page
  const lastOrgCredit  = allOrgCredits[0] ?? null;
  const totalCredits   = allOrgCredits.reduce((sum, c) => sum + (c.creditId?.limit_to ?? 0), 0);
  const creditsLeft    = totalCredits - assignedCount;

  function set(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function goToStep1() {
    if (checkingDup) return;
    if (!form.firstName.trim()) { toast.warning('Name is required.'); return; }
    if (!form.email.trim())     { toast.warning('Email is required.'); return; }
    if (!form.tempPassword.trim()) { toast.warning('Temporary password is required.'); return; }
    if (form.tempPassword.length < 6) { toast.warning('Temporary password must be at least 6 characters.'); return; }
    if (!form.confirmTempPassword) { toast.warning('Please confirm the temporary password.'); return; }
    if (form.tempPassword !== form.confirmTempPassword) { toast.warning('Temporary passwords do not match.'); return; }

    // Block on a duplicate email or WhatsApp No before letting the learner
    // move on — both are unique identifiers on the users table.
    setCheckingDup(true);
    try {
      const params = new URLSearchParams({ email: form.email.trim() });
      if (form.whatsapp_no.trim()) params.set('whatsapp_no', form.whatsapp_no.trim());
      const res = await apiServiceHandler('GET', `user/admin/check-exists?${params.toString()}`);
      const { emailExists, whatsappExists } = res?.data ?? res ?? {};

      if (emailExists && whatsappExists) {
        toast.warning('A learner with this email and WhatsApp No already exists.');
        return;
      }
      if (emailExists)    { toast.warning('A learner with this email already exists.'); return; }
      if (whatsappExists) { toast.warning('A learner with this WhatsApp No already exists.'); return; }

      setActiveStep(1);
    } catch (err) {
      toast.warning(err?.message || 'Could not verify email/WhatsApp No. Please try again.');
    } finally {
      setCheckingDup(false);
    }
  }

  function goToStep2() {
    if (selectedCourseIds.length === 0) { toast.warning('Please select at least one course to assign.'); return; }
    setActiveStep(2);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      // Step 1 — create user (employee)
      const createRes = await apiServiceHandler('POST', 'user/admin/create', {
        name: `${form.firstName} ${form.lastName}`.trim() || form.firstName,
        email: form.email,
        password: form.tempPassword,
        whatsapp_no: form.whatsapp_no,
        emp_id: form.employeeId,
        department: form.department,
        designation: form.designation,
        course_language: form.language,
        status: form.accountStatus,
        user_type: 'employee',
        orgRole: 'employee',
        orgId: resolvedOrgId,
      });

      const newUserId = createRes?.data?._id || createRes?._id;
      if (!newUserId) throw new Error('User creation failed — no ID returned.');

      // Step 2 — assign every selected course (draft courses included — the
      // learner is ready to study it as soon as it's published).
      await Promise.all(selectedCourses.map(course =>
        apiServiceHandler('POST', 'course-assignment/create', {
          organizationId: resolvedOrgId,
          userId: newUserId,
          courseId: course.id,
        })
      ));

      // Step 3 — adding a learner costs exactly 1 credit, regardless of how many
      // courses are assigned — but only if at least one of them is published.
      // If every selected course is still in draft, the learner is added for
      // free (no credit until a real, published course is actually assigned).
      const publishedCourses = selectedCourses.filter(c => c.status === 'published');
      if (publishedCourses.length > 0) {
        await apiServiceHandler('POST', 'credit-used/create', {
          orgId:     resolvedOrgId,
          learnerId: newUserId,
          courseId:  publishedCourses[0].id,
          status:    'active',
        });
      }

      // Step 4 — save notification preferences
      await apiServiceHandler('PUT', `user/admin/update/${newUserId}`, {
        email_welcome_noti: notifyPrefs.email,
        course_assign_noti: notifyPrefs.alert,
        weekly_progress_noti: notifyPrefs.digest,
      });

      toast.success('Learner added successfully.');
      router.push('/storeowner/users');
    } catch (err) {
      toast.warning(err?.message || 'Failed to save learner. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function toggleCourse(id) {
    setSelectedCourseIds(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]);
  }

  const selectedCourses = courses.filter(c => selectedCourseIds.includes(c.id));
  // Adding a learner costs a flat 1 credit — not 1 per course — and only once
  // at least one of the selected courses is actually published.
  const willConsumeCredit = selectedCourses.some(c => c.status === 'published');
  const creditsToConsume   = willConsumeCredit ? 1 : 0;

  function stepCircleClass(i) {
    if (i < activeStep) return `${s.stepCircle} ${s.stepCircleCheck}`;
    if (i === activeStep) return `${s.stepCircle} ${s.stepCircleActive}`;
    return s.stepCircle;
  }

  return (
    <>
      {/* Content */}
      <div className={s.content}>

        {/* Page heading row */}
        <div className={s.pageHeadRow}>
          <div className={s.pageHeadLeft}>
            <h1 className={s.pageTitle}>Add New Learner</h1>
            <span className={s.planBadge}>Pro plan</span>
          </div>
          <div className={s.pageHeadMeta}>
            <span className={s.metaItem}>
              <span className={s.metaIcon}>{Icon.users}</span>
              Learners <strong>{orDash(orgEmpCount)}</strong>
            </span>
            <span className={s.metaDivider} />
            <span className={s.metaItem}>
              <span className={s.metaIcon}>{Icon.credit}</span>
              Credits Remaining <strong>{totalCredits > 0 ? creditsLeft : '—'}</strong>
            </span>
          </div>
        </div>

        {/* Stepper */}
        <div className={s.stepper}>
          {STEPS.map((step, i) => (
            <div key={step.num} className={s.stepperItem}>
              <div className={stepCircleClass(i)}>
                {i < activeStep
                  ? <span style={{ display: 'flex', alignItems: 'center', width: 12, height: 12 }}>{Icon.check}</span>
                  : step.num}
              </div>
              <span className={`${s.stepLabel} ${i === activeStep ? s.stepLabelActive : ''}`}>{step.label}</span>
              {i < STEPS.length - 1 && <div className={s.stepLine} />}
            </div>
          ))}
        </div>

        {/* ── Step 0: Learner Details ── */}
        {activeStep === 0 && (
          <>
            <div className={s.creditsBanner}>
              <strong>Credits Remaining</strong>
              <p>
                {totalCredits > 0
                  ? `Only ${creditsLeft} credit${creditsLeft !== 1 ? 's' : ''} remaining.`
                  : 'Credits data loading…'}{' '}
                Adding a learner consumes 1 credit, deducted once the learner is added — no matter how many courses you assign. No enrollment beyond available credits.
              </p>
            </div>

            <div className={s.formCard}>
              <h2 className={s.sectionTitle}>Personal Information</h2>
              <div className={s.formGrid}>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Name <span className={s.req}>*</span></label>
                  <input className={s.input} placeholder="e.g. Kavita" value={form.firstName} onChange={set('firstName')} />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Email Address <span className={s.req}>*</span></label>
                  <input className={s.input} placeholder="Enter email address…" value={form.email} onChange={set('email')} type="email" />
                  <div className={s.fieldHint}>Used for login and email notifications</div>
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.label}>WhatsApp No <span className={s.req}>*</span></label>
                  <input className={s.input} placeholder="e.g. +91 98765 43210" value={form.whatsapp_no} onChange={set('whatsapp_no')} />
                  <div className={s.fieldHint}>Used for course reminders and alerts</div>
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Employee ID</label>
                  <input className={s.input} placeholder="WK-0123456" value={form.employeeId} onChange={set('employeeId')} />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Department</label>
                  <div className={s.selectWrapper}>
                    <select className={s.select} value={form.department} onChange={set('department')} disabled={departmentsLoading}>
                      <option value="">{departmentsLoading ? 'Loading departments…' : 'Select Department'}</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <span className={s.selectChevron}>{Icon.chevronDown}</span>
                  </div>
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Designation</label>
                  <div className={s.selectWrapper}>
                    <select className={s.select} value={form.designation} onChange={set('designation')} disabled={designationsLoading}>
                      <option value="">{designationsLoading ? 'Loading designations…' : 'Select Designation'}</option>
                      {designations.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <span className={s.selectChevron}>{Icon.chevronDown}</span>
                  </div>
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Language Preference</label>
                  <div className={s.selectWrapper}>
                    <select className={s.select} value={form.language} onChange={set('language')}>
                      <option value="">Select Language</option>
                      {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <span className={s.selectChevron}>{Icon.chevronDown}</span>
                  </div>
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Account Status</label>
                  <div className={s.selectWrapper}>
                    <select className={s.select} value={form.accountStatus} onChange={set('accountStatus')}>
                      <option value="active">Active – Can log in Immediately</option>
                      <option value="inactive">Inactive – Cannot log in</option>
                    </select>
                    <span className={s.selectChevron}>{Icon.chevronDown}</span>
                  </div>
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Temporary Password <span className={s.req}>*</span></label>
                  <PasswordInput className={s.input} placeholder="Password" value={form.tempPassword} onChange={set('tempPassword')} autoComplete="new-password" />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Temporary Confirm Password <span className={s.req}>*</span></label>
                  <PasswordInput className={s.input} placeholder="Re-enter the temporary password"
                    value={form.confirmTempPassword} onChange={set('confirmTempPassword')} autoComplete="new-password" />
                  {form.confirmTempPassword && form.confirmTempPassword !== form.tempPassword && (
                    <div className={s.fieldHint} style={{ color: '#dc2626' }}>Passwords do not match</div>
                  )}
                </div>
              </div>
              <div className={s.assignCourseRow}>
                <button type="button" className={s.btnAssignCourse} onClick={goToStep1} disabled={checkingDup}>
                  {checkingDup ? 'Checking…' : 'Assign Course'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 1: Assign Courses ── */}
        {activeStep === 1 && (
          <>
            <div className={s.selectCoursesCard}>
              <strong>Select Courses To Assign</strong>
              <p>Courses follow sequential access — learner must complete each video before unlocking the quiz and the next chapter. Only published courses are listed below — draft courses aren&apos;t ready for a learner yet. You can assign more than one at a time; adding this learner still costs just 1 credit in total, regardless of how many you select.</p>
            </div>
            <div className={s.courseListCard}>
              <div className={s.courseListTitle}>Available Courses</div>
              {coursesLoading ? (
                <div style={{ padding: '16px', color: '#888' }}>Loading courses…</div>
              ) : courses.length === 0 ? (
                <div style={{ padding: '16px', color: '#888' }}>No courses found.</div>
              ) : courses.map(course => {
                const isSelected = selectedCourseIds.includes(course.id);
                return (
                  <div key={course.id} className={`${s.courseItem} ${isSelected ? s.courseItemSelected : ''}`}
                    onClick={() => toggleCourse(course.id)}>
                    <div className={s.courseItemTop}>
                      <button
                        type="button"
                        className={`${s.courseCircleBtn} ${isSelected ? s.courseCircleBtnSelected : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleCourse(course.id); }}
                        aria-label={isSelected ? 'Deselect' : 'Select'}
                      >
                        {isSelected && <span className={s.courseCircleCheck}>{Icon.check}</span>}
                      </button>
                      <div className={s.courseInfo}>
                        <div className={s.courseName}>{course.name}</div>
                        {course.meta && <div className={s.courseMeta}>{course.meta}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Step 2: Notification & Confirm ── */}
        {activeStep === 2 && (
          <>
            {/* Select Courses To Assign banner */}
            <div className={s.selectCoursesCard}>
              <strong>Select Courses To Assign</strong>
              <p>Courses follow sequential access — learner must complete each video before unlocking the quiz and the next chapter.</p>
            </div>

            {/* Notification Preferences */}
            <div className={s.formCard} style={{ marginBottom: 16 }}>
              <h2 className={s.sectionTitle}>Notification Preferences</h2>
              <p className={s.notifSubtitle}>Send welcome notification</p>
              {[
                { key: 'email',    label: 'Email Welcome Message',    desc: 'Send account credentials and getting started guide' },
                { key: 'alert',    label: 'Course Assignment Alert',  desc: 'Notify learner of assigned courses with direct links' },
                { key: 'digest',   label: 'Weekly Progress Digest',   desc: 'Enroll in weekly progress summary email' },
              ].map(item => (
                <div key={item.key} className={s.notifRow}>
                  <div className={s.notifInfo}>
                    <div className={s.notifLabel}>{item.label}</div>
                    <div className={s.notifDesc}>{item.desc}</div>
                  </div>
                  <button
                    type="button"
                    className={`${s.toggleSwitch} ${notifyPrefs[item.key] ? s.toggleSwitchOn : ''}`}
                    onClick={() => setNotifyPrefs(p => ({ ...p, [item.key]: !p[item.key] }))}
                    aria-label={item.label}
                  >
                    <span className={s.toggleThumb} />
                  </button>
                </div>
              ))}
            </div>

            {/* Two-column: learner preview + store snapshot */}
            <div className={s.confirmCols}>
              {/* Left: Learner preview card */}
              <div className={s.learnerPreviewCard}>
                <div className={s.learnerAvatar}>
                  <div className={s.learnerAvatarCircle}>
                    {(form.firstName || form.lastName)
                      ? (form.firstName[0] || form.lastName[0]).toUpperCase()
                      : '?'}
                  </div>
                </div>
                <div className={s.learnerPreviewName}>
                  {(form.firstName || form.lastName)
                    ? `${form.firstName} ${form.lastName}`.trim()
                    : 'New Learner'}
                </div>
                <div className={s.learnerPreviewHint}>Fill in details to preview</div>

                <div className={s.learnerPreviewFields}>
                  <div className={s.learnerPreviewRow}>
                    <span className={s.lpLabel}>Employee ID</span>
                    <span className={s.lpValue}>{form.employeeId || '–'}</span>
                  </div>
                  <div className={s.learnerPreviewRow}>
                    <span className={s.lpLabel}>Department</span>
                    <span className={s.lpValue}>{form.department || '–'}</span>
                  </div>
                  <div className={s.learnerPreviewRow}>
                    <span className={s.lpLabel}>Language</span>
                    <span className={s.lpValue}>{form.language || '–'}</span>
                  </div>
                  <div className={s.learnerPreviewRow}>
                    <span className={s.lpLabel}>Status</span>
                    <span className={`${s.lpValue} ${s.statusActive}`}>Active</span>
                  </div>
                </div>

                <div className={s.learnerPreviewFootnote}>Learner will receive login details after saving</div>
              </div>

              {/* Right: Store snapshot + selected courses */}
              <div className={s.snapshotCol}>
                <div className={s.snapshotCard}>
                  <h3 className={s.snapshotTitle}>Store Snapshot</h3>
                  <div className={s.snapshotRow}><span className={s.snapshotKey}>Plan</span><span className={s.snapshotVal}>{lastOrgCredit?.creditId?.title || '–'}</span></div>
                  <div className={s.snapshotRow}><span className={s.snapshotKey}>Total learners</span><span className={s.snapshotVal}>{orgEmpCount != null ? orgEmpCount : '–'}</span></div>
                  <div className={s.snapshotRow}><span className={s.snapshotKey}>Credits remaining</span><span className={s.snapshotVal}>{totalCredits > 0 ? creditsLeft : '–'}</span></div>
                  <div className={s.snapshotRow}><span className={s.snapshotKey}>Credit cost</span><span className={s.snapshotVal}>1 Per Learner Added</span></div>
                  <div className={s.snapshotRow}><span className={s.snapshotKey}>After adding</span><span className={s.snapshotValAccent}>{totalCredits > 0 ? `${creditsLeft - creditsToConsume} Remaining` : '–'}</span></div>
                  <div className={s.snapshotRow}><span className={s.snapshotKey}>Credits used</span><span className={s.snapshotVal}>{assignedCount}</span></div>
                </div>

                <div className={s.snapshotCard} style={{ marginTop: 12 }}>
                  <h3 className={s.snapshotTitle}>Selected Courses</h3>
                  {selectedCourses.length > 0
                    ? selectedCourses.map(c => (
                      <div key={c.id} className={s.selectedCourseRow}>
                        <span className={s.selectedCourseName}>{c.name}</span>
                        <span className={c.status === 'published' ? s.courseStatusPublished : s.courseStatusDraft}>
                          {c.status === 'published' ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    ))
                    : <div className={s.noCoursesHint}>No courses selected</div>}
                  <div className={s.totalSelectedRow}>
                    <span className={s.totalSelectedLabel}>Total Selected</span>
                    <span className={s.totalSelectedVal}>{selectedCourses.length} Course{selectedCourses.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className={s.totalSelectedRow}>
                    <span className={s.totalSelectedLabel}>Credit Impact</span>
                    <span className={s.totalSelectedVal}>
                      {selectedCourses.length === 0 ? '—' : willConsumeCredit ? '1 credit' : 'Free (no published course yet)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

      </div>

      {/* Footer nav */}
      <div className={s.footer}>
        {activeStep === 0 ? (
          <button className={s.btnCancel} onClick={() => router.push('/storeowner/users')}>
            <span className={s.footerArrow}>{Icon.arrowLeft}</span>
            Cancel
          </button>
        ) : (
          <button className={s.btnCancel} onClick={() => setActiveStep(activeStep - 1)}>
            <span className={s.footerArrow}>{Icon.arrowLeft}</span>
            Back
          </button>
        )}
        {activeStep === 0 && (
          <button className={s.btnNext} onClick={goToStep1} disabled={checkingDup}>
            {checkingDup ? 'Checking…' : 'Next: Assign Courses'}
            {!checkingDup && <span className={s.footerArrow}>{Icon.arrowRight}</span>}
          </button>
        )}
        {activeStep === 1 && (
          <button className={s.btnNext} onClick={goToStep2}>
            Next: Confirm &amp; Notify
            <span className={s.footerArrow}>{Icon.arrowRight}</span>
          </button>
        )}
        {activeStep === 2 && (
          <div className={s.footerRightGroup}>
            <button className={s.btnDiscard} onClick={() => { setForm(EMPTY_FORM); setSelectedCourseIds([]); setActiveStep(0); }}>
              Discard
            </button>
            <button className={s.btnNext} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save & Add Learner'}
              {!saving && <span className={s.footerArrow}>{Icon.arrowRight}</span>}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
