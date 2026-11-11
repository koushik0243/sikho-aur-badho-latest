'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from '../OrgCourseAssignment/EditOrgCourseAssignment.module.css';
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

export const LIST_PATH = '/superadmin/user-course-assignment';

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);

const listOf = res => (Array.isArray(res?.data) ? res.data : []);
const idOf = v => String(v?._id ?? v ?? '');

export default function EditUserCourseAssignment() {
  const router = useRouter();
  const params = useParams();
  const orgId = String(params?.orgId || '');
  const userId = String(params?.userId || '');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [orgName, setOrgName] = useState('');
  const [learner, setLearner] = useState(null);
  const [courses, setCourses] = useState([]);          // [{ id, title }]
  const [assignments, setAssignments] = useState([]);  // this learner's course_assignments in this org
  const [checked, setChecked] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!orgId || !userId) return undefined;
    let cancelled = false;
    Promise.all([
      apiServiceHandler('GET', `organization/edit/${orgId}`),
      apiServiceHandler('GET', `user/admin/edit/${userId}`),
      apiServiceHandler('GET', `organization-course/list?orgId=${orgId}&status=active`),
      apiServiceHandler('GET', `course-assignment/list?organizationId=${orgId}&userId=${userId}&t=${Date.now()}`),
    ]).then(([orgRes, userRes, ocRes, caRes]) => {
      if (cancelled) return;
      const user = userRes?.data ?? null;
      if (!user?._id) { setLoadError('Learner not found.'); return; }
      if (idOf(user.orgId) !== orgId) { setLoadError('This learner does not belong to this organization.'); return; }

      const mine = listOf(caRes);
      // The organization's courses, plus any course the learner still has that
      // was since removed from the organization (so it can be unassigned too).
      const byId = new Map();
      for (const oc of listOf(ocRes)) byId.set(idOf(oc.courseId), oc.courseId?.title || '—');
      for (const a of mine) if (!byId.has(idOf(a.courseId))) byId.set(idOf(a.courseId), a.courseId?.title || '—');

      setOrgName(orgRes?.data?.org_name || '—');
      setLearner(user);
      setCourses([...byId].filter(([id]) => id).map(([id, title]) => ({ id, title })));
      setAssignments(mine);
      setChecked(new Set(mine.map(a => idOf(a.courseId))));
    }).catch(() => {
      if (!cancelled) setLoadError('Failed to load this learner’s courses. Please try again.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [orgId, userId]);

  function toggleCourse(courseId) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId); else next.add(courseId);
      return next;
    });
  }

  const goToList = () => router.push(LIST_PATH);

  async function handleSubmit() {
    const current = new Set(assignments.map(a => idOf(a.courseId)));
    const toAdd = [...checked].filter(id => !current.has(id));
    const toRemove = assignments.filter(a => !checked.has(idOf(a.courseId)));
    if (toAdd.length === 0 && toRemove.length === 0) { toast.info('No changes to save.'); return; }

    setSubmitting(true);
    try {
      await Promise.all([
        // Same steps as assigning: the assignment (emails the learner), then the credit-usage record.
        ...toAdd.map(async courseId => {
          await apiServiceHandler('POST', 'course-assignment/create', { organizationId: orgId, userId, courseId });
          await apiServiceHandler('POST', 'credit-used/create', { orgId, learnerId: userId, courseId, status: 'active' });
        }),
        ...toRemove.map(a => apiServiceHandler('GET', `course-assignment/delete/${a._id}`)),
      ]);
      const parts = [
        toAdd.length ? `${toAdd.length} course${toAdd.length === 1 ? '' : 's'} assigned` : '',
        toRemove.length ? `${toRemove.length} removed` : '',
      ].filter(Boolean);
      toast.success(`${parts.join(', ')}.`);
      goToList();
    } catch (err) {
      toast.warning(err?.message || 'Failed to update the learner’s courses. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const header = (
    <>
      <button className={s.backBtn} onClick={goToList}>
        <BackIcon /> Back
      </button>
      <h1 className={s.pageTitle}>Edit User Course Assignment</h1>
      <p className={s.pageSubtitle}>Manage assigned courses for the selected learner</p>
    </>
  );

  if (loading || loadError) {
    return (
      <SuperAdminShell activeSection="assign-user-course">
        {header}
        <p style={{ padding: '24px 0', color: loadError ? '#dc2626' : '#6b7280', fontSize: 14 }}>{loadError || 'Loading…'}</p>
      </SuperAdminShell>
    );
  }

  return (
    <SuperAdminShell activeSection="assign-user-course">
      {header}

      <div className={s.formCard}>
        <div className={s.formGroup}>
          <label>Organization</label>
          <div className={s.orgNameDisplay}>{orgName}</div>
        </div>

        <div className={s.formGroup}>
          <label>Learner</label>
          <div className={s.orgNameDisplay}>
            {learner?.name || '—'}
            {learner?.email && <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: 6 }}>({learner.email})</span>}
          </div>
        </div>

        <div className={s.formGroup}>
          <label>
            Assigned Courses
            <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>({checked.size} selected)</span>
          </label>
          {courses.length === 0 ? (
            <p className={s.emptyHint}>This organization has no courses yet. Assign courses to the organization first.</p>
          ) : (
            <div className={s.courseList}>
              {courses.map(c => (
                <label key={c.id} className={s.courseItem}>
                  <input type="checkbox" checked={checked.has(c.id)} onChange={() => toggleCourse(c.id)} disabled={submitting} />
                  <span className={s.courseItemTitle}>{c.title}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className={s.formActions}>
          <button className={s.btnPublish} disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
          <button className={s.btnCancel} onClick={goToList} disabled={submitting}>
            Cancel
          </button>
        </div>
      </div>
    </SuperAdminShell>
  );
}
