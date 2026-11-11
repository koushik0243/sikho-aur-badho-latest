'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import useDepartments from '../../../hooks/useDepartments';
import useDesignations from '../../../hooks/useDesignations';
import pageStyles from "./EditLearner.module.css";
import { withFormKit } from '../PageKit/PageKit';

// Page styles + the shared store owner form look.
const s = withFormKit(pageStyles);

const Icon = {
  chevronDown: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>,
};

const LANGUAGES   = ['English', 'Hindi'];

const EMPTY_FORM = {
  name: '', email: '', whatsapp_no: '',
  employeeId: '', department: '', designation: '',
  language: '', accessStartDate: '', accountStatus: 'active',
};

// Same three preferences shown (read-only) on the View page's Notification
// Preferences card — editable here as toggles.
const NOTIF_ITEMS = [
  { key: 'email',  label: 'Welcome Email',           desc: 'Account credentials and getting started guide' },
  { key: 'alert',  label: 'Course Assignment Alerts', desc: 'Notify learner of assigned courses with direct links' },
  { key: 'digest', label: 'Weekly Progress Digest',   desc: 'Weekly progress summary email' },
];

export default function EditLearnerPage() {
  const { id } = useParams();
  const router = useRouter();

  const [form, setForm]           = useState(EMPTY_FORM);
  // Department options come from SuperAdmin → Manage Department; the learner's
  // saved department stays selectable even if it's since been removed.
  const { departments, loading: departmentsLoading } = useDepartments(form.department);
  // Designation options come from SuperAdmin → Manage Designation.
  const { designations, loading: designationsLoading } = useDesignations(form.designation);
  const [notifyPrefs, setNotifyPrefs] = useState({ email: false, alert: false, digest: false });
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiServiceHandler('GET', `user/admin/edit/${id}`);
      const data = res?.data ?? res;
      if (!data?._id) { setNotFound(true); return; }
      setForm({
        name:            data.name || '',
        email:           data.email || '',
        whatsapp_no:     data.whatsapp_no || '',
        employeeId:      data.emp_id || '',
        department:      data.department || '',
        designation:     data.designation || '',
        language:        data.course_language || '',
        accessStartDate: data.access_start ? String(data.access_start).slice(0, 10) : '',
        accountStatus:   data.status || 'active',
      });
      setNotifyPrefs({
        email:  !!data.email_welcome_noti,
        alert:  !!data.course_assign_noti,
        digest: !!data.weekly_progress_noti,
      });
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function set(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim())  { toast.warning('Name is required.'); return; }
    if (!form.email.trim()) { toast.warning('Email is required.'); return; }

    setSaving(true);
    try {
      await apiServiceHandler('PUT', `user/admin/update/${id}`, {
        name: form.name.trim(),
        email: form.email.trim(),
        whatsapp_no: form.whatsapp_no,
        emp_id: form.employeeId,
        department: form.department,
        designation: form.designation,
        course_language: form.language,
        access_start: form.accessStartDate || null,
        status: form.accountStatus,
        email_welcome_noti: notifyPrefs.email,
        course_assign_noti: notifyPrefs.alert,
        weekly_progress_noti: notifyPrefs.digest,
      });
      toast.success('Learner updated successfully.');
      router.push(`/storeowner/users/${id}`);
    } catch (err) {
      toast.warning(err?.message || 'Failed to update learner. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <nav className={s.breadcrumb}>
        <button className={s.breadcrumbLink} onClick={() => router.push('/storeowner/users')}>
          User Management
        </button>
        <span className={s.breadcrumbSep}>›</span>
        <button className={s.breadcrumbLink} onClick={() => router.push(`/storeowner/users/${id}`)}>
          {loading ? '…' : (form.name || 'Learner')}
        </button>
        <span className={s.breadcrumbSep}>›</span>
        <span className={s.breadcrumbCurr}>Edit</span>
      </nav>

      {notFound ? (
        <div className={s.notFound}>
          <div className={s.notFoundTitle}>Learner not found</div>
          <button className={s.btnCancel} onClick={() => router.push('/storeowner/users')}>← Back to User Management</button>
        </div>
      ) : (
        <div className={s.card}>
          <div className={s.cardHead}><h2 className={s.cardTitle}>Edit Learner</h2></div>
          <form onSubmit={handleSave}>
            <div className={s.cardBody}>
              {loading ? (
                <div className={s.formGrid}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className={s.fieldGroup}>
                      <div className={s.skeletonLine} style={{ width: '40%' }} />
                      <div className={s.skeletonInput} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className={s.formGrid}>
                  <div className={s.fieldGroup}>
                    <label className={s.label}>Name <span className={s.req}>*</span></label>
                    <input className={s.input} placeholder="e.g. Kavita" value={form.name} onChange={set('name')} />
                  </div>
                  <div className={s.fieldGroup}>
                    <label className={s.label}>Email Address <span className={s.req}>*</span></label>
                    <input className={s.input} type="email" placeholder="Enter email address…" value={form.email} onChange={set('email')} />
                  </div>
                  <div className={s.fieldGroup}>
                    <label className={s.label}>WhatsApp No</label>
                    <input className={s.input} placeholder="e.g. +91 98765 43210" value={form.whatsapp_no} onChange={set('whatsapp_no')} />
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
                    <label className={s.label}>Access Start Date</label>
                    <input className={s.input} type="date" value={form.accessStartDate} onChange={set('accessStartDate')} />
                  </div>
                  <div className={s.fieldGroup}>
                    <label className={s.label}>Account Status</label>
                    <div className={s.selectWrapper}>
                      <select className={s.select} value={form.accountStatus} onChange={set('accountStatus')}>
                        <option value="active">Active – Can log in Immediately</option>
                        <option value="inactive">Inactive – Cannot log in</option>
                        <option value="suspended">Suspended</option>
                      </select>
                      <span className={s.selectChevron}>{Icon.chevronDown}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Notification Preferences ── */}
            <div className={s.notifSection}>
              <h3 className={s.notifSectionTitle}>Notification Preferences</h3>
              {loading ? (
                <div className={s.skeletonLine} style={{ width: '60%' }} />
              ) : NOTIF_ITEMS.map(item => (
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

            <div className={s.formActions}>
              <button type="button" className={s.btnCancel} onClick={() => router.push(`/storeowner/users/${id}`)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className={s.btnSave} disabled={saving || loading}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
