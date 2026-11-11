'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import { API_URL } from '../../../lib/constant';
import SuperAdminShell from '../SuperAdminShell';
import IndustryTypeTree from './IndustryTypeTree';
import sPage from "./EditOrganization.module.css";
import PasswordInput from '../../PasswordInput/PasswordInput';
import { withAdminKit } from '../AdminKit/AdminKit';
import { orDash } from '../../../lib/displayValue';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

// Taller Industry Type list so more options show without scrolling.
const INDUSTRY_LIST_HEIGHT = 200;

const BackArrow = (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

const OrgInfoIcon = (
  <svg viewBox="0 0 20 20" fill="#2563eb">
    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
  </svg>
);

const OwnerIcon = (
  <svg viewBox="0 0 20 20" fill="#0b7b7b">
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
);

const CoursesIcon = (
  <svg viewBox="0 0 20 20" fill="#7c3aed">
    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4 7.962 7.962 0 009 5.189V4.804z" />
  </svg>
);

// Optional 10-digit Indian mobile number, with or without a +91 country code
// (matches the "+91 98765 43210" format already used elsewhere,
// e.g. client/src/Components/StoreOwner/AddLearner/AddLearner.js).
const WHATSAPP_NO_REGEX = /^(\+91[\s-]?)?[6-9]\d{9}$/;

export default function EditOrganization() {
  const router = useRouter();
  const { id } = useParams();

  const [loading, setLoading]                   = useState(true);
  const [notFound, setNotFound]                 = useState(false);
  const [orgName, setOrgName]                   = useState('');
  const [logoFile, setLogoFile]                 = useState(null);
  const [logoPreview, setLogoPreview]           = useState('');
  const [existingLogo, setExistingLogo]         = useState('');
  const [industryTypeIds, setIndustryTypeIds]   = useState([]);
  const [industryTypes, setIndustryTypes]       = useState([]);
  const [ownerUserId, setOwnerUserId]           = useState('');
  const [ownerEmail, setOwnerEmail]             = useState('');
  const [ownerWhatsapp, setOwnerWhatsapp]       = useState('');
  const [ownerPassword, setOwnerPassword]       = useState('');
  const [ownerConfirmPassword, setOwnerConfirmPassword] = useState('');
  const [pwReadOnly, setPwReadOnly]             = useState(true);
  const [confirmPwReadOnly, setConfirmPwReadOnly] = useState(true);
  const [courses, setCourses]                   = useState([]);
  const [selectedCourses, setSelectedCourses]   = useState([]);
  const [courseSearch, setCourseSearch]         = useState('');
  const [errors, setErrors]                     = useState({});
  const [submitting, setSubmitting]             = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    Promise.all([
      apiServiceHandler('GET', `organization/edit/${id}`).catch(() => null),
      apiServiceHandler('GET', 'course/list-pagination?limit=500&page=1&status=published').catch(() => null),
      apiServiceHandler('GET', 'industry-type/list-all').catch(() => null),
      apiServiceHandler('GET', `organization-course/list?orgId=${id}`).catch(() => null),
      apiServiceHandler('GET', `user/admin/list-pagination?page=1&limit=1&user_type=organization&orgId=${id}&orgRole=owner`).catch(() => null),
    ]).then(([orgRes, courseRes, indRes, ocRes, ownerUserRes]) => {
      const org = orgRes?.data;
      if (!org) { setNotFound(true); setLoading(false); return; }

      setOrgName(org.org_name ?? '');
      if (org.org_logo) setExistingLogo(`${API_URL}${org.org_logo}`);

      const indIds = Array.isArray(org.industryTypeIds)
        ? org.industryTypeIds.map(i => String(i._id ?? i))
        : [];
      setIndustryTypeIds(indIds);

      const types = Array.isArray(indRes?.data) ? indRes.data : (Array.isArray(indRes) ? indRes : []);
      setIndustryTypes(types);

      const ownerObj = org.ownerId && typeof org.ownerId === 'object' ? org.ownerId : null;
      const ownerUserFallback = Array.isArray(ownerUserRes?.data) ? ownerUserRes.data[0] : null;
      const resolvedOwnerId = ownerObj?._id ?? (typeof org.ownerId === 'string' ? org.ownerId : '') ?? String(ownerUserFallback?._id ?? '');
      const resolvedEmail   = ownerObj?.email ?? org.owner_email ?? ownerUserFallback?.email ?? '';
      const resolvedWhatsapp = ownerObj?.whatsapp_no ?? ownerUserFallback?.whatsapp_no ?? '';
      setOwnerUserId(resolvedOwnerId);
      setOwnerEmail(resolvedEmail);
      setOwnerWhatsapp(resolvedWhatsapp);

      const ocCourseIds = (Array.isArray(ocRes?.data) ? ocRes.data : [])
        .map(r => String(r.courseId?._id ?? r.courseId));
      if (ocCourseIds.length > 0) {
        setSelectedCourses(ocCourseIds);
      } else {
        const orgCourseIds = Array.isArray(org.course_ids)
          ? org.course_ids.map(c => String(c._id ?? c))
          : [];
        setSelectedCourses(orgCourseIds);
      }

      const list = Array.isArray(courseRes?.data) ? courseRes.data
        : Array.isArray(courseRes?.data?.courses) ? courseRes.data.courses
        : Array.isArray(courseRes?.courses) ? courseRes.courses
        : [];
      setCourses(list);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoPreview('');
    setExistingLogo('');
  }

  function toggleCourse(cid) {
    setSelectedCourses(prev =>
      prev.includes(cid) ? prev.filter(c => c !== cid) : [...prev, cid]
    );
  }

  function toggleSelectAll() {
    const visible = filteredCourses.map(c => String(c._id));
    const allSelected = visible.every(id => selectedCourses.includes(id));
    if (allSelected) {
      setSelectedCourses(prev => prev.filter(id => !visible.includes(id)));
    } else {
      setSelectedCourses(prev => [...new Set([...prev, ...visible])]);
    }
  }

  const filteredCourses = courses.filter(c =>
    (c.title ?? c.name ?? '').toLowerCase().includes(courseSearch.toLowerCase())
  );

  const allVisibleSelected =
    filteredCourses.length > 0 &&
    filteredCourses.every(c => selectedCourses.includes(String(c._id)));

  function validate() {
    const e = {};
    if (!orgName.trim()) e.org_name = 'Organization name is required.';
    const hasEmail    = ownerEmail.trim() !== '';
    const hasPassword = ownerPassword !== '';
    if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim()))
      e.owner_email = 'Enter a valid email address.';
    if (!ownerWhatsapp.trim()) e.owner_whatsapp = 'WhatsApp number is required.';
    else if (!WHATSAPP_NO_REGEX.test(ownerWhatsapp.trim()))
      e.owner_whatsapp = 'Enter a valid 10-digit mobile number (optionally with +91).';
    if (hasPassword) {
      if (ownerPassword.length < 6) e.owner_password = 'Password must be at least 6 characters.';
      if (ownerPassword !== ownerConfirmPassword) e.owner_confirm = 'Passwords do not match.';
    }
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const hasEmail    = ownerEmail.trim() !== '';
      const hasPassword = ownerPassword !== '';
      let resolvedOwnerId = ownerUserId;

      const hasWhatsapp = ownerWhatsapp.trim() !== '';

      if (hasEmail || hasPassword || hasWhatsapp) {
        if (ownerUserId) {
          const userPayload = { user_type: 'organization', orgId: id, orgRole: 'owner', status: 'active' };
          if (hasEmail)     { userPayload.name = ownerEmail.trim(); userPayload.email = ownerEmail.trim(); }
          if (hasPassword)  { userPayload.password = ownerPassword; }
          if (hasWhatsapp)  { userPayload.whatsapp_no = ownerWhatsapp.trim(); }
          await apiServiceHandler('PUT', `user/admin/update/${ownerUserId}`, userPayload);
        } else if (hasEmail && hasPassword) {
          const userRes = await apiServiceHandler('POST', 'user/admin/create', {
            name:        ownerEmail.trim(),
            email:       ownerEmail.trim(),
            password:    ownerPassword,
            whatsapp_no: ownerWhatsapp.trim(),
            user_type:   'organization',
            orgId:       id,
            orgRole:     'owner',
            status:      'active',
          });
          resolvedOwnerId = userRes?.data?._id ?? userRes?.data?.id ?? userRes?._id ?? userRes?.id ?? null;
        }
      }

      const fd = new FormData();
      fd.append('org_name', orgName.trim());
      fd.append('course_ids', JSON.stringify(selectedCourses));
      fd.append('industryTypeIds', JSON.stringify(industryTypeIds));
      if (resolvedOwnerId) fd.append('ownerId', resolvedOwnerId);
      if (logoFile) fd.append('org_logo', logoFile);
      await apiServiceHandler('PUT', `organization/update/${id}`, fd);

      const [existingOcRes, learnerRes] = await Promise.all([
        apiServiceHandler('GET', `organization-course/list?orgId=${id}`).catch(() => null),
        apiServiceHandler('GET', `organization-course-assignment/list?orgId=${id}`).catch(() => null),
      ]);
      const existingOcRecords = Array.isArray(existingOcRes?.data) ? existingOcRes.data : [];
      const existingOcIds = new Set(existingOcRecords.map(r => String(r.courseId?._id ?? r.courseId)));
      const lockedIds = new Set(
        (Array.isArray(learnerRes?.data) ? learnerRes.data : [])
          .map(r => String(r.courseId?._id ?? r.courseId))
      );
      const toAdd    = selectedCourses.filter(cid => !existingOcIds.has(cid));
      const toRemove = existingOcRecords.filter(r => {
        const cid = String(r.courseId?._id ?? r.courseId);
        return !selectedCourses.includes(cid) && !lockedIds.has(cid);
      });
      await Promise.all([
        ...toAdd.map(courseId =>
          apiServiceHandler('POST', 'organization-course/create', { orgId: id, courseId, status: 'active' })
            .catch(() => null)
        ),
        ...toRemove.map(r =>
          apiServiceHandler('GET', `organization-course/delete/${r._id}`)
            .catch(() => null)
        ),
      ]);

      toast.success('Organization updated successfully.');
      router.push('/superadmin/organizations');
    } catch (err) {
      toast.warning(err?.message || 'Failed to update organization. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SuperAdminShell activeSection="organizations">
        <p style={{ padding: '40px', color: '#6b7280' }}>Loading…</p>
      </SuperAdminShell>
    );
  }

  if (notFound) {
    return (
      <SuperAdminShell activeSection="organizations">
        <p style={{ padding: '40px', color: '#dc2626' }}>Organization not found.</p>
      </SuperAdminShell>
    );
  }

  return (
    <SuperAdminShell activeSection="organizations">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/organizations')}>
        {BackArrow} Back to Organizations
      </button>

      <h1 className={s.pageTitle}>Edit Organization</h1>
      <p className={s.pageSubtitle}>Update organization details</p>

      <form onSubmit={handleSubmit} autoComplete="off">
        {/* ── Organization Information ── */}
        <div className={s.sectionCard}>
          <div className={s.sectionHeader}>
            <div className={s.sectionHeaderLeft}>{OrgInfoIcon} Organization Information</div>
          </div>
          <div className={s.sectionBody}>
            <div className={s.formRow}>
              {/* Left column: Org Name + Logo stacked */}
              <div className={s.formGroupStack}>
                <div className={s.formGroup}>
                  <label className={s.label}>Organization Name <span className={s.required}>*</span></label>
                  <input
                    className={s.input}
                    type="text"
                    placeholder="Enter organization name"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    autoComplete="off"
                  />
                  {errors.org_name && <span className={s.errorMsg}>{errors.org_name}</span>}
                </div>

                <div className={s.formGroup}>
                  <label className={s.label}>Logo Image</label>
                  {(logoPreview || existingLogo) ? (
                    <div className={s.imagePreviewWrap}>
                      <img src={logoPreview || existingLogo} alt="Logo preview" className={s.imagePreview} />
                      <button type="button" className={s.imageRemoveBtn} onClick={clearLogo}>Remove</button>
                    </div>
                  ) : (
                    <label className={s.imageUploadArea}>
                      <input type="file" accept="image/*" className={s.imageFileInput} onChange={handleLogoChange} autoComplete="off" />
                      <span className={s.imageUploadIcon}>
                        <svg viewBox="0 0 20 20" fill="currentColor" width="22" height="22">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                      </span>
                      <span className={s.imageUploadText}>Click to upload logo</span>
                      <span className={s.imageUploadHint}>PNG, JPG, WEBP up to 5 MB</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Right column: Industry Type tree */}
              <div className={s.formGroup}>
                <label className={s.label}>
                  Industry Type
                  {industryTypeIds.length > 0 && (
                    <span className={s.coursesBadge}>{industryTypeIds.length} selected</span>
                  )}
                </label>
                <IndustryTypeTree
                  industryTypes={industryTypes}
                  setIndustryTypes={setIndustryTypes}
                  selectedIds={industryTypeIds}
                  setSelectedIds={setIndustryTypeIds}
                  listHeight={INDUSTRY_LIST_HEIGHT}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Owner Account ── */}
        <div className={s.sectionCard}>
          <div className={s.sectionHeader}>
            <div className={s.sectionHeaderLeft}>{OwnerIcon} Owner Account</div>
          </div>
          <div className={s.sectionBody}>
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
              Email and password are optional — leave blank to keep existing values unchanged. WhatsApp No is required.
            </p>
            <div className={s.formRow}>
              <div className={s.formGroup}>
                <label className={s.label}>Email</label>
                <input
                  className={s.input}
                  type="email"
                  placeholder="owner@organization.com"
                  value={ownerEmail}
                  onChange={e => setOwnerEmail(e.target.value)}
                  autoComplete="off"
                />
                {errors.owner_email && <span className={s.errorMsg}>{errors.owner_email}</span>}
              </div>
              <div className={s.formGroup}>
                <label className={s.label}>WhatsApp No <span className={s.required}>*</span></label>
                <input
                  className={s.input}
                  type="tel"
                  placeholder="e.g. 98765 43210"
                  value={ownerWhatsapp}
                  onChange={e => setOwnerWhatsapp(e.target.value)}
                  autoComplete="off"
                />
                {errors.owner_whatsapp && <span className={s.errorMsg}>{errors.owner_whatsapp}</span>}
              </div>
            </div>
            <div className={s.formRow}>
              <div className={s.formGroup}>
                <label className={s.label}>New Password</label>
                <PasswordInput
                  className={s.input}
                  placeholder="Leave blank to keep current password"
                  value={ownerPassword}
                  onChange={e => setOwnerPassword(e.target.value)}
                  readOnly={pwReadOnly}
                  onFocus={() => setPwReadOnly(false)}
                  autoComplete="new-password"
                />
                {errors.owner_password && <span className={s.errorMsg}>{errors.owner_password}</span>}
              </div>
              <div className={s.formGroup}>
                <label className={s.label}>Confirm New Password</label>
                <PasswordInput
                  className={s.input}
                  placeholder="Re-enter new password"
                  value={ownerConfirmPassword}
                  onChange={e => setOwnerConfirmPassword(e.target.value)}
                  readOnly={confirmPwReadOnly}
                  onFocus={() => setConfirmPwReadOnly(false)}
                  autoComplete="new-password"
                />
                {errors.owner_confirm && <span className={s.errorMsg}>{errors.owner_confirm}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* ── Courses ── */}
        <div className={s.sectionCard}>
          <div className={s.sectionHeader}>
            <div className={s.sectionHeaderLeft}>
              {CoursesIcon} Courses
              {selectedCourses.length > 0 && (
                <span className={s.coursesBadge}>{selectedCourses.length} selected</span>
              )}
            </div>
          </div>
          <div className={s.sectionBody}>
            <input
              className={s.input}
              type="text"
              placeholder="Search courses…"
              value={courseSearch}
              onChange={e => setCourseSearch(e.target.value)}
              autoComplete="off"
            />
            {courses.length === 0 ? (
              <p className={s.coursesEmpty}>No courses available.</p>
            ) : (
              <div className={s.coursesContainer}>
                <label className={s.courseSelectAllRow}>
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} autoComplete="off" />
                  <span>Select All</span>
                </label>
                <div className={s.coursesList} style={{ maxHeight: 200, overflowY: 'auto', overflowX: 'hidden' }}>
                  {filteredCourses.length === 0 ? (
                    <p className={s.coursesEmpty}>No matching courses.</p>
                  ) : (
                    filteredCourses.map(course => {
                      const cid = String(course._id);
                      return (
                        <label key={cid} className={s.courseRow}>
                          <input
                            type="checkbox"
                            checked={selectedCourses.includes(cid)}
                            onChange={() => toggleCourse(cid)}
                            autoComplete="off"
                          />
                          <span className={s.courseTitle}>{orDash(course.title || course.name)}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {errors.submit && <p className={s.errorMsg}>{errors.submit}</p>}
        <div className={s.formActions}>
          <button type="button" className={s.btnCancel} onClick={() => router.push('/superadmin/organizations')}>
            Cancel
          </button>
          <button type="submit" className={s.btnSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Organization'}
          </button>
        </div>
      </form>
    </SuperAdminShell>
  );
}
