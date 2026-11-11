'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import apiServiceHandler from '../../service/apiService';
import IndustryTypeTree from '../SuperAdmin/Organizations/IndustryTypeTree';
import s from "./OrganizationSignup.module.css";
import PasswordInput from '../PasswordInput/PasswordInput';

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

// 10-digit Indian mobile number, with or without a +91 country code — matches
// the same rule enforced server-side (server/organization_signup/organization_signup.service.js).
const WHATSAPP_NO_REGEX = /^(\+91[\s-]?)?[6-9]\d{9}$/;

export default function OrganizationSignup() {
  const router = useRouter();

  const [orgName, setOrgName]                 = useState('');
  const [logoFile, setLogoFile]               = useState(null);
  const [logoPreview, setLogoPreview]         = useState('');
  const [industryTypeIds, setIndustryTypeIds] = useState([]);
  const [industryTypes, setIndustryTypes]     = useState([]);
  const [ownerEmail, setOwnerEmail]           = useState('');
  const [ownerWhatsapp, setOwnerWhatsapp]     = useState('');
  const [ownerPassword, setOwnerPassword]     = useState('');
  const [ownerConfirmPassword, setOwnerConfirmPassword] = useState('');
  const [errors, setErrors]                   = useState({});
  const [submitting, setSubmitting]           = useState(false);

  useEffect(() => {
    apiServiceHandler('GET', 'signup/industry-types')
      .then(res => setIndustryTypes(Array.isArray(res?.data) ? res.data : []))
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
      fd.append('industryTypeIds', JSON.stringify(industryTypeIds));
      fd.append('owner_email', ownerEmail.trim());
      fd.append('owner_whatsapp', ownerWhatsapp.trim());
      fd.append('owner_password', ownerPassword);
      if (logoFile) fd.append('org_logo', logoFile);

      await apiServiceHandler('POST', 'signup', fd);

      toast.success('Organization created! You can now log in.');
      router.push('/login');
    } catch (err) {
      toast.warning(err?.message || 'Failed to create your organization. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={s.page}>
      <div className={s.container}>
        <div className={s.brand}>
          <img src="/logo.png" alt="sikhoaurbadho" className={s.brandLogoImg} />
        </div>

        <Link href="/login" className={s.backLink}>
          {BackArrow} Back to Login
        </Link>

        <h1 className={s.pageTitle}>Create Your Organization</h1>
        <p className={s.pageSubtitle}>Sign up as a store owner to start assigning courses to your team</p>

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

                {/* Right column: Industry Type tree (read-select only — no adding new categories from a public page) */}
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
                    allowAdd={false}
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
                  <label className={s.label}>Email / Username <span className={s.required}>*</span></label>
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
              <div className={s.formRow} style={{ marginTop: "20px" }}>
                <div className={s.formGroup}>
                  <label className={s.label}>Password <span className={s.required}>*</span></label>
                  <PasswordInput
                    className={s.input}
                    placeholder="Minimum 6 characters"
                    value={ownerPassword}
                    onChange={e => setOwnerPassword(e.target.value)}
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
                    autoComplete="new-password"
                  />
                  {errors.owner_confirm && <span className={s.errorMsg}>{errors.owner_confirm}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className={s.formActions}>
            <button type="submit" className={s.btnSubmit} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Organization'}
            </button>
          </div>
        </form>

        <p className={s.loginPrompt}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
