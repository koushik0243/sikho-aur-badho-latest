'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import IndustryTypeTree from './IndustryTypeTree';
import sPage from "./AddOrganization.module.css";
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

export default function AddOrganization() {
  const router = useRouter();

  const [orgName, setOrgName]                   = useState('');
  const [logoFile, setLogoFile]                 = useState(null);
  const [logoPreview, setLogoPreview]           = useState('');
  const [industryTypeIds, setIndustryTypeIds]   = useState([]);
  const [industryTypes, setIndustryTypes]       = useState([]);
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

  useEffect(() => {
    Promise.all([
      apiServiceHandler('GET', 'course/list-pagination?limit=500&page=1&status=published'),
      apiServiceHandler('GET', 'industry-type/list-all'),
    ])
      .then(([courseRes, indRes]) => {
        const list = Array.isArray(courseRes?.data) ? courseRes.data
          : Array.isArray(courseRes?.data?.courses) ? courseRes.data.courses
          : Array.isArray(courseRes?.courses) ? courseRes.courses
          : [];
        setCourses(list);
        const types = Array.isArray(indRes?.data) ? indRes.data : (Array.isArray(indRes) ? indRes : []);
        setIndustryTypes(types);
      })
      .catch(() => {});
  }, []);

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoPreview('');
  }

  function toggleCourse(id) {
    setSelectedCourses(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
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
    if (!ownerEmail.trim()) e.owner_email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim()))
      e.owner_email = 'Enter a valid email address.';
    if (!ownerWhatsapp.trim()) e.owner_whatsapp = 'WhatsApp number is required.';
    else if (!WHATSAPP_NO_REGEX.test(ownerWhatsapp.trim()))
      e.owner_whatsapp = 'Enter a valid 10-digit mobile number (optionally with +91).';
    if (!ownerPassword) e.owner_password = 'Password is required.';
    else if (ownerPassword.length < 6) e.owner_password = 'Password must be at least 6 characters.';
    if (ownerPassword !== ownerConfirmPassword)
      e.owner_confirm = 'Passwords do not match.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('org_name', orgName.trim());
      fd.append('ownerId', '');
      fd.append('course_ids', JSON.stringify(selectedCourses));
      fd.append('industryTypeIds', JSON.stringify(industryTypeIds));
      fd.append('status', 'active');
      if (logoFile) fd.append('org_logo', logoFile);
      const orgRes = await apiServiceHandler('POST', 'organization/create', fd);
      const orgId = orgRes?.data?._id ?? orgRes?.data?.id ?? orgRes?._id ?? orgRes?.id ?? null;

      const userRes = await apiServiceHandler('POST', 'user/admin/create', {
        name:        ownerEmail.trim(),
        email:       ownerEmail.trim(),
        password:    ownerPassword,
        whatsapp_no: ownerWhatsapp.trim(),
        user_type:   'organization',
        orgId,
        orgRole:     'owner',
        status:      'active',
      });
      const userId = userRes?.data?._id ?? userRes?.data?.id ?? userRes?._id ?? userRes?.id ?? null;

      if (orgId && userId) {
        await apiServiceHandler('PUT', `organization/update/${orgId}`, { ownerId: userId });
      }

      if (orgId && selectedCourses.length > 0) {
        await Promise.all(
          selectedCourses.map(courseId =>
            apiServiceHandler('POST', 'organization-course/create', { orgId, courseId, status: 'active' })
              .catch(() => null)
          )
        );
      }

      toast.success('Organization created successfully.');
      router.push('/superadmin/organizations');
    } catch (err) {
      toast.warning(err?.message || 'Failed to create organization. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SuperAdminShell activeSection="organizations">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/organizations')}>
        {BackArrow} Back to Organizations
      </button>

      <h1 className={s.pageTitle}>Add Organization</h1>
      <p className={s.pageSubtitle}>Create a new organization</p>

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
                  {logoPreview ? (
                    <div className={s.imagePreviewWrap}>
                      <img src={logoPreview} alt="Logo preview" className={s.imagePreview} />
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
            <div className={s.formRow}>
              <div className={s.formGroup}>
                <label className={s.label}>Email <span className={s.required}>*</span></label>
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
                <label className={s.label}>Password <span className={s.required}>*</span></label>
                <PasswordInput
                  className={s.input}
                  placeholder="Minimum 6 characters"
                  value={ownerPassword}
                  onChange={e => setOwnerPassword(e.target.value)}
                  readOnly={pwReadOnly}
                  onFocus={() => setPwReadOnly(false)}
                  autoComplete="new-password"
                />
                {errors.owner_password && <span className={s.errorMsg}>{errors.owner_password}</span>}
              </div>
              <div className={s.formGroup}>
                <label className={s.label}>Confirm Password <span className={s.required}>*</span></label>
                <PasswordInput
                  className={s.input}
                  placeholder="Re-enter password"
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
            {submitting ? 'Creating…' : 'Create Organization'}
          </button>
        </div>
      </form>
    </SuperAdminShell>
  );
}
