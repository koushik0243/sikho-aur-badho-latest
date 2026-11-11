'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./EditOrgCourseAssignment.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export default function EditOrgCourseAssignment() {
  const router = useRouter();
  const params = useParams();
  const orgId = params?.orgId;

  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState('');
  const [allCourses, setAllCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [lockedCourseIds, setLockedCourseIds] = useState(new Set());
  const [checkedCourseIds, setCheckedCourseIds] = useState(new Set());
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);

    const pCourses = apiServiceHandler('GET', 'course/list').catch(() => null);
    const pAssigned = apiServiceHandler('GET', `organization-course/list?orgId=${orgId}`).catch(() => null);
    const pLearner = apiServiceHandler('GET', `organization-course-assignment/list?orgId=${orgId}`).catch(() => null);

    Promise.all([pCourses, pAssigned, pLearner])
      .then(([coursesRes, assignedRes, learnerRes]) => {
        setAllCourses(Array.isArray(coursesRes?.data) ? coursesRes.data : []);

        const assigned = Array.isArray(assignedRes?.data) ? assignedRes.data : [];
        setAssignments(assigned);

        const currentChecked = new Set(assigned.map(r => r.courseId?._id ?? r.courseId));
        setCheckedCourseIds(currentChecked);

        if (assigned.length > 0) {
          setOrgName(assigned[0].orgId?.org_name || '');
        }

        const learnerList = Array.isArray(learnerRes?.data) ? learnerRes.data : [];
        const locked = new Set(learnerList.map(r => r.courseId?._id ?? r.courseId));
        setLockedCourseIds(locked);
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  function toggleCourse(courseId) {
    if (lockedCourseIds.has(courseId)) return;
    setCheckedCourseIds(prev => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  async function handleSubmit() {
    setErrors({});
    setSubmitting(true);
    try {
      const currentIds = new Set(assignments.map(r => r.courseId?._id ?? r.courseId));

      // Courses to add: checked but not yet assigned
      const toAdd = [...checkedCourseIds].filter(id => !currentIds.has(id));

      // Courses to remove: assigned, unchecked, and not locked
      const toRemove = assignments.filter(r => {
        const cId = r.courseId?._id ?? r.courseId;
        return !checkedCourseIds.has(cId) && !lockedCourseIds.has(cId);
      });

      await Promise.all([
        ...toAdd.map(courseId =>
          apiServiceHandler('POST', 'organization-course/create', { orgId, courseId, status: 'active' })
        ),
        ...toRemove.map(r =>
          apiServiceHandler('GET', `organization-course/delete/${r._id}`)
        ),
      ]);

      toast.success('Assignments updated successfully.');
      window.location.href = '/superadmin/organization-course-assignment';
    } catch (err) {
      toast.warning(err?.message || 'Failed to update assignments. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SuperAdminShell activeSection="assign-course">
        <p style={{ padding: '40px 0', color: '#6b7280', fontSize: 14 }}>Loading…</p>
      </SuperAdminShell>
    );
  }

  return (
    <SuperAdminShell activeSection="assign-course">
      <button className={s.backBtn} onClick={() => { router.push('/superadmin/organization-course-assignment'); router.refresh(); }}>
        <BackIcon /> Back
      </button>
      <h1 className={s.pageTitle}>Edit Course Assignment</h1>
      <p className={s.pageSubtitle}>Manage assigned courses for the selected organization</p>

      <div className={s.formCard}>
        {/* Org name (read-only) */}
        <div className={s.formGroup}>
          <label>Organization</label>
          <div className={s.orgNameDisplay}>{orgName || '—'}</div>
        </div>

        {/* Course checkboxes */}
        <div className={s.formGroup}>
          <label>
            Assigned Courses
            {lockedCourseIds.size > 0 && (
              <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>
                ({lockedCourseIds.size} locked — assigned to learners)
              </span>
            )}
          </label>
          {allCourses.length === 0 ? (
            <p className={s.emptyHint}>No courses available.</p>
          ) : (
            <div className={s.courseList}>
              {allCourses.map(c => {
                const isChecked = checkedCourseIds.has(c._id);
                const isLocked = lockedCourseIds.has(c._id);
                return (
                  <label
                    key={c._id}
                    className={`${s.courseItem} ${isLocked ? s.courseItemLocked : ''}`}
                    title={isLocked ? 'This course has been assigned to a learner and cannot be removed.' : ''}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isLocked}
                      onChange={() => toggleCourse(c._id)}
                    />
                    <span className={s.courseItemTitle}>{c.title}</span>
                    {isLocked && (
                      <span className={s.lockedBadge}>
                        <LockIcon /> Learner Assigned
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {errors.submit && <p className={s.errorMsg}>{errors.submit}</p>}

        <div className={s.formActions}>
          <button className={s.btnPublish} disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            className={s.btnCancel}
            onClick={() => { router.push('/superadmin/organization-course-assignment'); router.refresh(); }}
          >
            Cancel
          </button>
        </div>
      </div>
    </SuperAdminShell>
  );
}
