'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./OrgUserAssignmentEdit.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);

function displayName(u) {
  return [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.username || u?.email || '—';
}

export default function OrgUserAssignmentEdit() {
  const router = useRouter();
  const { id } = useParams();

  const [user, setUser]       = useState(null);
  const [orgs, setOrgs]       = useState([]);
  const [orgId, setOrgId]     = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState({});

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiServiceHandler('GET', `user/admin/edit/${id}`),
      apiServiceHandler('GET', 'organization/list'),
    ])
      .then(([userRes, orgsRes]) => {
        const found = userRes?.data ?? userRes;
        if (found?._id) {
          setUser(found);
          setOrgId(found.orgId?._id || String(found.orgId || ''));
        }
        setOrgs(Array.isArray(orgsRes?.data) ? orgsRes.data : []);
      })
      .catch(() => toast.warning('Failed to load data.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave(e) {
    e.preventDefault();
    const errs = {};
    if (!orgId) errs.orgId = 'Please select an organization.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    try {
      await apiServiceHandler('PUT', `user/admin/update/${id}`, { orgId });
      toast.success('Assignment updated.');
      window.location.href = '/superadmin/organization-user-assignment';
    } catch {
      toast.warning('Failed to update assignment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SuperAdminShell activeSection="assign-user">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/organization-user-assignment')}>
        <BackIcon /> Back
      </button>
      <h1 className={s.pageTitle}>Edit User Assignment</h1>
      <p className={s.pageSubtitle} style={{ marginBottom: 20 }}>
        Reassign this employee to a different organization
      </p>

      <div className={s.formCard}>
        {loading ? (
          <div className={s.emptyHint}>Loading…</div>
        ) : !user ? (
          <div className={s.emptyHint} style={{ color: '#dc2626' }}>User not found.</div>
        ) : (
          <form onSubmit={handleSave} autoComplete="off">
            <div className={s.formGroup}>
              <p className={s.sectionHeading}>User</p>
              <div className={s.userListBox}>
                <div className={`${s.userListItem} ${s.assigned}`}>
                  <div className={s.userInfo}>
                    <div className={s.userName}>{displayName(user)}</div>
                    <div className={s.userEmail}>{user.email}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className={s.formGroup}>
              <label>
                Organization <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select value={orgId} onChange={e => setOrgId(e.target.value)}>
                <option value="">— Select organization —</option>
                {orgs.map(o => (
                  <option key={o._id} value={o._id}>
                    {o.org_name || o.name || o._id}
                  </option>
                ))}
              </select>
              {errors.orgId && <p className={s.errorMsg}>{errors.orgId}</p>}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button type="submit" className={s.btnSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                type="button"
                className={s.backBtn}
                style={{ margin: 0 }}
                onClick={() => router.push('/superadmin/organization-user-assignment')}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </SuperAdminShell>
  );
}
