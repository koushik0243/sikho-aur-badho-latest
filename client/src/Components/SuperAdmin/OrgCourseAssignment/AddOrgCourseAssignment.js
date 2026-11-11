'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./AddOrgCourseAssignment.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);

export default function AddOrgCourseAssignment() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlOrgId = searchParams.get('orgId') ?? '';

  const [orgs, setOrgs]                   = useState([]);
  const [orgName, setOrgName]             = useState('');
  const [courses, setCourses]             = useState([]);
  const [orgId, setOrgId]                 = useState(urlOrgId);
  const [selectedCourseIds, setSelectedCourseIds] = useState(new Set());
  const [existingOcIds, setExistingOcIds] = useState(new Set());
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [errors, setErrors]               = useState({});
  const [submitting, setSubmitting]       = useState(false);

  const backPath = urlOrgId
    ? `/superadmin/organization-course-assignment?orgId=${urlOrgId}`
    : '/superadmin/organization-course-assignment';

  // Load courses (always) and orgs (only when no orgId in URL)
  useEffect(() => {
    apiServiceHandler('GET', 'course/list?status=published')
      .then(res => setCourses(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});

    if (!urlOrgId) {
      apiServiceHandler('GET', 'organization/list')
        .then(res => setOrgs(Array.isArray(res?.data) ? res.data : []))
        .catch(() => {});
    }
  }, [urlOrgId]);

  // When orgId changes (or on mount with URL orgId), load existing assignments + org name
  useEffect(() => {
    if (!orgId) {
      setExistingOcIds(new Set());
      setSelectedCourseIds(new Set());
      setOrgName('');
      return;
    }
    setLoadingExisting(true);
    setSelectedCourseIds(new Set());
    setExistingOcIds(new Set());

    Promise.all([
      apiServiceHandler('GET', `organization-course/list?orgId=${orgId}`).catch(() => null),
      apiServiceHandler('GET', `organization/edit/${orgId}`).catch(() => null),
    ]).then(([ocRes, orgRes]) => {
      const ocIds = new Set(
        (Array.isArray(ocRes?.data) ? ocRes.data : []).map(r => String(r.courseId?._id ?? r.courseId))
      );
      setExistingOcIds(ocIds);
      if (orgRes?.data?.org_name) setOrgName(orgRes.data.org_name);
    }).finally(() => setLoadingExisting(false));
  }, [orgId]);

  function toggleCourse(courseId) {
    const cid = String(courseId);
    setSelectedCourseIds(prev => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid); else next.add(cid);
      return next;
    });
  }

  function validate() {
    const e = {};
    if (!orgId) e.orgId = 'Please select an organization.';
    return e;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const toCreate = [...selectedCourseIds].filter(cId => !existingOcIds.has(cId));
      if (toCreate.length === 0) {
        toast.info('No new courses selected.');
        return;
      }
      await Promise.all(
        toCreate.map(courseId =>
          apiServiceHandler('POST', 'organization-course/create', { orgId, courseId, status: 'active' })
        )
      );
      toast.success('Courses assigned successfully.');
      router.push(backPath);
    } catch (err) {
      toast.warning(err?.message || 'Failed to assign courses. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Courses available to assign = all courses minus already-assigned ones
  const availableCourses = courses.filter(c => !existingOcIds.has(String(c._id)));

  return (
    <SuperAdminShell activeSection="assign-course">
      <button className={s.backBtn} onClick={() => router.push(backPath)}>
        <BackIcon /> Back
      </button>
      <h1 className={s.pageTitle}>Add Course Assignment</h1>
      <p className={s.pageSubtitle}>Assign courses to an organization</p>

      <div className={s.formCard}>

        {/* Organization — dropdown when no URL orgId, readonly display when orgId from URL */}
        {urlOrgId ? (
          <div className={s.formGroup}>
            <label>Organization</label>
            <span className={s.orgNameDisplay}>{orgName || urlOrgId}</span>
          </div>
        ) : (
          <div className={s.formGroup}>
            <label>Organization *</label>
            <select value={orgId} onChange={e => setOrgId(e.target.value)}>
              <option value="">— Select organization —</option>
              {orgs.map(org => (
                <option key={org._id} value={org._id}>{org.org_name}</option>
              ))}
            </select>
            {errors.orgId && <p className={s.errorMsg}>{errors.orgId}</p>}
          </div>
        )}

        {/* Course checkboxes — only unassigned courses */}
        {orgId && (
          <div className={s.formGroup}>
            <label>Select Courses</label>
            {loadingExisting ? (
              <p className={s.emptyHint}>Loading courses…</p>
            ) : availableCourses.length === 0 ? (
              <p className={s.emptyHint}>All courses are already assigned to this organization.</p>
            ) : (
              <div className={s.courseList}>
                {availableCourses.map(c => {
                  const cid = String(c._id);
                  return (
                    <label key={cid} className={s.courseItem}>
                      <input
                        type="checkbox"
                        checked={selectedCourseIds.has(cid)}
                        onChange={() => toggleCourse(cid)}
                      />
                      <span className={s.courseItemTitle}>{c.title}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {errors.submit && <p className={s.errorMsg}>{errors.submit}</p>}

        <div className={s.formActions}>
          <button className={s.btnPublish} disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Saving…' : 'Assign Courses'}
          </button>
          <button className={s.btnCancel} onClick={() => router.push(backPath)}>
            Cancel
          </button>
        </div>
      </div>
    </SuperAdminShell>
  );
}
