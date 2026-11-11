'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./OrgUserAssignmentAdd.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);

function displayName(u) {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || u.username || u.email || '—';
}

function AssignUsersForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const preOrgId     = searchParams.get('orgId') || '';

  const [orgs, setOrgs]                 = useState([]);
  const [orgId, setOrgId]               = useState(preOrgId);
  const [allUsers, setAllUsers]         = useState([]);
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [selectedIds, setSelectedIds]   = useState(new Set());
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchUser, setSearchUser]     = useState('');
  const [errors, setErrors]             = useState({});
  const [submitting, setSubmitting]     = useState(false);

  useEffect(() => {
    apiServiceHandler('GET', 'organization/list')
      .then(res => setOrgs(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const loadUsers = useCallback(() => {
    if (!orgId) {
      setAllUsers([]);
      setAssignedUsers([]);
      setSelectedIds(new Set());
      return;
    }
    setLoadingUsers(true);
    Promise.all([
      apiServiceHandler('GET', 'user/admin/list-pagination?user_type=employee&orgRole=employee&orgId=null&deletedAt=null&limit=1000')
        .then(res => (Array.isArray(res?.data) ? res.data : []).filter(
          u => u.user_type === 'employee' && !u.orgId && u.orgRole === 'employee' && !u.deletedAt
        ))
        .catch(() => []),
      apiServiceHandler('GET', `user/admin/list-pagination?user_type=employee&orgRole=employee&orgId=${orgId}&limit=1000`)
        .then(res => (Array.isArray(res?.data) ? res.data : []).filter(u => {
          const userOrgId = typeof u.orgId === 'object' ? u.orgId?._id : u.orgId;
          return u.user_type === 'employee' && u.orgRole === 'employee' && !u.deletedAt
            && String(userOrgId) === String(orgId);
        }))
        .catch(() => []),
    ]).then(([available, assigned]) => {
      setAllUsers(available);
      setAssignedUsers(assigned);
      setSelectedIds(new Set());
    }).finally(() => setLoadingUsers(false));
  }, [orgId]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  function toggleUser(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const displayed = filteredUsers;
    const allSel    = displayed.length > 0 && displayed.every(u => selectedIds.has(u._id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      displayed.forEach(u => allSel ? next.delete(u._id) : next.add(u._id));
      return next;
    });
  }

  function validate() {
    const e = {};
    if (!orgId) e.orgId = 'Please select an organization.';
    return e;
  }

  const backPath = preOrgId
    ? `/superadmin/organization-user-assignment?orgId=${preOrgId}`
    : '/superadmin/organization-user-assignment';

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await Promise.all(
        [...selectedIds].map(id => apiServiceHandler('PUT', `user/admin/update/${id}`, { orgId }))
      );
      toast.success(`${selectedIds.size} user${selectedIds.size !== 1 ? 's' : ''} assigned successfully.`);
      window.location.href = backPath;
    } catch {
      toast.warning('Failed to assign users. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredUsers = allUsers.filter(u => {
    if (!searchUser.trim()) return true;
    const term = searchUser.toLowerCase();
    return displayName(u).toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term);
  });

  const allDisplayedSelected =
    filteredUsers.length > 0 && filteredUsers.every(u => selectedIds.has(u._id));

  return (
    <>
      <button className={s.backBtn} onClick={() => router.push(backPath)}>
        <BackIcon /> Back
      </button>
      <h1 className={s.pageTitle}>Assign Users to Organization</h1>
      <p className={s.pageSubtitle} style={{ marginBottom: 20 }}>
        Select an organization and manage its employee assignments
      </p>

      <div className={s.formCard}>
        {/* Organization dropdown */}
        <div className={s.formGroup}>
          <label>Organization *</label>
          <select value={orgId} onChange={e => setOrgId(e.target.value)} disabled={Boolean(preOrgId)}>
            <option value="">— Select organization —</option>
            {orgs.map(org => (
              <option key={org._id} value={org._id}>
                {org.org_name || org.name || org._id}
              </option>
            ))}
          </select>
          {errors.orgId && <p className={s.errorMsg}>{errors.orgId}</p>}
        </div>

        {orgId && assignedUsers.length > 0 && (
          <div className={s.formGroup}>
            <p className={s.sectionHeading}>Assigned Users</p>
            <p className={s.sectionHint}>Users already assigned to this organization</p>
            <div className={s.userListBox}>
              {assignedUsers.map(u => (
                <div key={u._id} className={`${s.userListItem} ${s.assigned}`}>
                  <div style={{ flex: 1 }}>
                    <div className={s.userName}>{displayName(u)}</div>
                    <div className={s.userEmail}>{u.email}</div>
                  </div>
                  <span className={s.assignedTag}>Assigned</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {orgId && (
          <div className={s.formGroup}>
            <p className={s.sectionHeading}>Available Users</p>
            <p className={s.sectionHint}>Users not yet assigned to any organization</p>

            {loadingUsers ? (
              <div className={s.emptyHint}>Loading employees…</div>
            ) : (
              <>
                <input
                  type="text"
                  className={s.userSearch}
                  placeholder="Search by name or email…"
                  value={searchUser}
                  onChange={e => setSearchUser(e.target.value)}
                />
                <div className={s.userListBox}>
                  {filteredUsers.length === 0 ? (
                    <div className={s.emptyHint}>No employees found.</div>
                  ) : (
                    <>
                      <div className={s.selectAllRow}>
                        <input
                          type="checkbox"
                          id="sel-all"
                          checked={allDisplayedSelected}
                          onChange={toggleAll}
                        />
                        <label htmlFor="sel-all" style={{ cursor: 'pointer' }}>
                          Select all ({filteredUsers.length})
                        </label>
                      </div>
                      {filteredUsers.map(u => (
                        <div key={u._id} className={s.userListItem}>
                          <input
                            type="checkbox"
                            id={`u-${u._id}`}
                            checked={selectedIds.has(u._id)}
                            onChange={() => toggleUser(u._id)}
                          />
                          <label htmlFor={`u-${u._id}`} style={{ flex: 1, cursor: 'pointer' }}>
                            <div className={s.userName}>{displayName(u)}</div>
                            <div className={s.userEmail}>{u.email}</div>
                          </label>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}
            {errors.users && <p className={s.errorMsg} style={{ marginTop: 6 }}>{errors.users}</p>}
          </div>
        )}

        {orgId && (
          <button className={s.btnSave} onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? 'Assigning…'
              : `Assign${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''} Users`}
          </button>
        )}
      </div>
    </>
  );
}

export default function OrgUserAssignmentAdd() {
  return (
    <SuperAdminShell activeSection="assign-user">
      <Suspense fallback={<div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>}>
        <AssignUsersForm />
      </Suspense>
    </SuperAdminShell>
  );
}
