'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../../../redux/slices/authSlice';
import apiServiceHandler from '../../../service/apiService';
import PasswordInput from '../../PasswordInput/PasswordInput';
import pageStyles from "./StoreProfile.module.css";
import { withFormKit } from '../PageKit/PageKit';

// Page styles + the shared store owner form look.
const s = withFormKit(pageStyles);

const EMPTY_ORG = {
  org_name: '', industry: '', emp_count: '',
};

const EMPTY_PERSONAL = {
  email: '', whatsapp_no: '',
};

function buildTree(items) {
  const map = {};
  items.forEach(item => (map[String(item._id)] = { ...item, children: [] }));
  const roots = [];
  items.forEach(item => {
    const pid = item.parentId ? String(item.parentId) : null;
    if (pid && map[pid]) {
      map[pid].children.push(map[String(item._id)]);
    } else if (!pid) {
      roots.push(map[String(item._id)]);
    }
  });
  return roots;
}

function flattenTree(nodes, depth = 0) {
  const result = [];
  for (const node of nodes) {
    result.push({ _id: node._id, name: node.name, depth });
    if (node.children?.length) result.push(...flattenTree(node.children, depth + 1));
  }
  return result;
}

// ── Skeleton loader ────────────────────────────────────────────
function SkeletonField() {
  return (
    <div className={s.fieldGroup}>
      <div className={`${s.skeletonLine}`} style={{ width: '40%' }} />
      <div className={s.skeletonInput} />
    </div>
  );
}

export default function StoreProfilePage() {
  const user = useSelector(selectUser);

  const userId = user?._id;
  const orgId = user?.orgId;

  // ── Decode JWT from localStorage as fallback for page-refresh ──
  function getTokenUserId() {
    if (typeof window === 'undefined') return null;
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return null;
      // Decode JWT payload (base64url → JSON) — client only needs the _id, auth is server-side
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload._id || null;
    } catch {
      return null;
    }
  }

  // ── State ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message: string }

  const [orgForm, setOrgForm] = useState(EMPTY_ORG);
  const [personalForm, setPersonalForm] = useState(EMPTY_PERSONAL);
  // Password fields are write-only — never loaded from the server, left blank means
  // "don't change it" (see handleSave).
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Resolved org _id — may differ from user.orgId if we find it via ownerId lookup
  const [resolvedOrgId, setResolvedOrgId] = useState(orgId ? String(orgId) : null);
  // Resolved owner user _id — from org.ownerId populated object
  const [resolvedOwnerId, setResolvedOwnerId] = useState(null);
  const [industryOptions, setIndustryOptions] = useState([]);
  const [notifPrefs, setNotifPrefs] = useState([
    { id: 'email',    key: 'email_digest',    label: 'Email Digest',                desc: 'Weekly summary report',              enabled: true  },
    { id: 'credits',  key: 'credit_alert',   label: 'Credit Alerts',               desc: 'Notify when credits below 20%',      enabled: true  },
    { id: 'zoom',     key: 'zoom_reminder',  label: 'Zoom Session Reminders',      desc: 'Learner progress, quiz failures',    enabled: true  },
    { id: 'cert',     key: 'cert_issue_alert', label: 'Certification Issuance Alerts', desc: 'When learner earns certificate', enabled: false },
  ]);

  // ── Helpers ────────────────────────────────────────────────────
  /** Extract .data payload from apiServiceHandler response ({ status, message, data }) */
  const extract = (res) => res?.data ?? res;

  // ── Fetch org + user on mount ──────────────────────────────────
  const loadData = useCallback(async () => {
    // Resolve userId — from Redux (just logged in) or from JWT (page refresh)
    const effectiveUserId = userId || getTokenUserId();
    if (!effectiveUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch personal data from the users table
      const userRes = await apiServiceHandler('GET', `user/admin/edit/${effectiveUserId}`);
      const userRecord = extract(userRes);

      if (userRecord) {
        setPersonalForm({
          email:       userRecord.email       || '',
          whatsapp_no: userRecord.whatsapp_no  || '',
        });
      } else {
        setPersonalForm({
          email:       user?.email || '',
          whatsapp_no: '',
        });
      }

      // 2. Determine orgId from DB record → Redux → fallback lookup by ownerId
      const dbOrgId = userRecord?.orgId ? String(userRecord.orgId) : null;
      const reduxOrgId = orgId ? String(orgId) : null;
      let effectiveOrgId = dbOrgId || reduxOrgId;

      // 3. Fetch org by orgId
      let orgData = null;
      if (effectiveOrgId) {
        const orgRes = await apiServiceHandler('GET', `organization/${effectiveOrgId}`);
        orgData = extract(orgRes);
      }

      // 4. Fallback: look up org by ownerId
      if (!orgData) {
        const listRes = await apiServiceHandler('GET', `organization/list?ownerId=${effectiveUserId}`);
        const list = extract(listRes);
        const arr = Array.isArray(list) ? list : [];
        if (arr.length > 0) {
          orgData = arr[0];
          effectiveOrgId = String(arr[0]._id);
        }
      }

      if (effectiveOrgId) setResolvedOrgId(effectiveOrgId);

      if (orgData) {
        setOrgForm({
          org_name:  orgData.org_name  || '',
          industry:  orgData.industry  || '',
          emp_count: orgData.emp_count || '',
        });
        // Prefill notification toggles from org record
        setNotifPrefs(prev => prev.map(p => ({
          ...p,
          enabled: orgData[p.key] ?? p.enabled,
        })));
        // Owner email/whatsapp come from the populated ownerId object in the org response
        if (orgData.ownerId && typeof orgData.ownerId === 'object' && orgData.ownerId._id) {
          setResolvedOwnerId(String(orgData.ownerId._id));
          setPersonalForm(prev => ({
            ...prev,
            email:       orgData.ownerId.email       || prev.email,
            whatsapp_no: orgData.ownerId.whatsapp_no  || prev.whatsapp_no,
          }));
        }
      }
    } catch {
      setPersonalForm({ email: user?.email || '', whatsapp_no: '' });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // run once on mount — getTokenUserId reads localStorage directly

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    apiServiceHandler('GET', 'industry-type/list-all')
      .then(res => {
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        const items = list.map(item => ({
          _id:      String(item._id),
          name:     item.name,
          parentId: item.parentId ? String(item.parentId) : null,
        }));
        setIndustryOptions(flattenTree(buildTree(items)));
      })
      .catch(() => {});
  }, []);

  // ── Handlers ───────────────────────────────────────────────────
  function setOrg(key, val) {
    setOrgForm(prev => ({ ...prev, [key]: val }));
  }

  function setPersonal(key, val) {
    setPersonalForm(prev => ({ ...prev, [key]: val }));
  }

  async function toggleNotif(id) {
    // Optimistically update UI
    const updated = notifPrefs.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p);
    setNotifPrefs(updated);
    // Persist to DB immediately
    const pref = updated.find(p => p.id === id);
    const currentOrgId = resolvedOrgId;
    if (pref && currentOrgId) {
      try {
        await apiServiceHandler('PUT', `organization/update/${currentOrgId}`, { [pref.key]: pref.enabled });
      } catch {
        // Revert on failure
        setNotifPrefs(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
      }
    }
  }

  async function handleSave(e) {
    e.preventDefault();

    // Every field except Password/Confirm Password is required — those two stay
    // optional (blank = keep the current password unchanged).
    if (!orgForm.org_name.trim() || !personalForm.email.trim() || !personalForm.whatsapp_no.trim()
      || !orgForm.industry.trim() || !String(orgForm.emp_count).trim()) {
      setStatus({ type: 'error', message: 'Please fill in all required fields (marked with *) before saving.' });
      return;
    }

    // Password is optional — leave both fields blank to keep the current password
    // unchanged. If either is filled, both must match and meet the minimum length.
    if (password || confirmPassword) {
      if (password.length < 6) {
        setStatus({ type: 'error', message: 'Password must be at least 6 characters.' });
        return;
      }
      if (password !== confirmPassword) {
        setStatus({ type: 'error', message: 'Passwords do not match.' });
        return;
      }
    }

    setSaving(true);
    setStatus(null);
    const effectiveUserId = userId || getTokenUserId();
    try {
      const calls = [];
      const ownerIdToUpdate = resolvedOwnerId || effectiveUserId;
      if (ownerIdToUpdate) {
        const userPayload = {
          email:       personalForm.email,
          whatsapp_no: personalForm.whatsapp_no,
        };
        if (password) userPayload.password = password;
        calls.push(apiServiceHandler('PUT', `user/admin/update/${ownerIdToUpdate}`, userPayload));
      }
      if (resolvedOrgId) {
        calls.push(apiServiceHandler('PUT', `organization/update/${resolvedOrgId}`, orgForm));
      }
      await Promise.all(calls);
      setPassword('');
      setConfirmPassword('');
      setStatus({ type: 'success', message: 'Profile saved successfully.' });
    } catch (err) {
      setStatus({ type: 'error', message: err?.message || 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {status && (
        <div className={`${s.statusBar} ${status.type === 'success' ? s.statusSuccess : s.statusError}`}>
          {status.message}
        </div>
      )}

      <div className={s.contentRow}>
        {/* ── Store Profile form card ── */}
        <div className={s.formCard}>
          <div className={s.cardHead}><h2 className={s.cardTitle}>Store Profile</h2></div>
          <div className={s.cardBody}>
          <form onSubmit={handleSave}>
            {loading ? (
              <div className={s.grid2}>
                <SkeletonField /><SkeletonField /><SkeletonField /><SkeletonField />
                <SkeletonField /><SkeletonField /><SkeletonField />
              </div>
            ) : (
              <div className={s.grid2}>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Store Name <span className={s.required}>*</span></label>
                  <input className={s.input} value={orgForm.org_name}
                    onChange={e => setOrg('org_name', e.target.value)} placeholder="Enter Name..." />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Owner Email <span className={s.required}>*</span></label>
                  <input className={s.input} type="email" value={personalForm.email}
                    onChange={e => setPersonal('email', e.target.value)} placeholder="Enter Email Id..." />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Password</label>
                  <PasswordInput className={s.input} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="Leave blank to keep current password" autoComplete="new-password" />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Confirm Password</label>
                  <PasswordInput className={s.input} value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} placeholder="Leave blank to keep current password" autoComplete="new-password" />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.label}>WhatsApp No <span className={s.required}>*</span></label>
                  <input className={s.input} value={personalForm.whatsapp_no}
                    onChange={e => setPersonal('whatsapp_no', e.target.value)} placeholder="Enter WhatsApp Number..." />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Industry <span className={s.required}>*</span></label>
                  <select className={s.select} value={orgForm.industry}
                    onChange={e => setOrg('industry', e.target.value)}>
                    <option value="">Select Industry...</option>
                    {industryOptions.map(opt => (
                      <option key={opt._id} value={opt._id}>
                        {'  '.repeat(opt.depth)}{opt.depth > 0 ? '↳ ' : ''}{opt.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Number Of Employees <span className={s.required}>*</span></label>
                  <input className={s.input} value={orgForm.emp_count}
                    onChange={e => setOrg('emp_count', e.target.value)} placeholder="Enter Number..." />
                </div>
              </div>
            )}
            <div className={s.formActions}>
              <button type="submit" className={s.btnSave} disabled={saving || loading}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:6}}><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
          </div>
        </div>

        {/* ── Notification Preferences ── */}
        <div className={s.notifCard}>
          <div className={s.cardHead}><h2 className={s.cardTitle}>Notifications</h2></div>
          <div className={s.cardBody}>
          {notifPrefs.map(pref => (
            <div key={pref.id} className={s.notifItem}>
              <div className={s.notifText}>
                <div className={s.notifLabel}>{pref.label}</div>
                <div className={s.notifDesc}>{pref.desc}</div>
              </div>
              <button
                type="button"
                className={`${s.toggle} ${pref.enabled ? s.toggleOn : ''}`}
                onClick={() => toggleNotif(pref.id)}
                aria-label={pref.enabled ? 'Disable' : 'Enable'}
              >
                <span className={s.toggleThumb} />
              </button>
            </div>
          ))}
          </div>
        </div>
      </div>
    </>
  );
}
