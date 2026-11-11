'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import { selectUser, selectUserType } from '../../../redux/slices/authSlice';
import sPage from "./AddRolePermission.module.css";
import rpPage from "./AddRolePermission.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);
const rp = withAdminKit(rpPage);

const BackArrow = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
  </svg>
);

const ACTIONS = ['add', 'edit', 'delete', 'view'];

function groupPermissions(permissions) {
  const groups = {};
  permissions.forEach(p => {
    let action = null;
    let moduleKey = p.name;
    for (const a of ACTIONS) {
      if (p.name.startsWith(a + '_')) {
        action = a;
        moduleKey = p.name.slice(a.length + 1);
        break;
      }
    }
    if (!groups[moduleKey]) {
      let label = moduleKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      if (action && p.display_name) {
        const prefix = action.charAt(0).toUpperCase() + action.slice(1) + ' ';
        if (p.display_name.startsWith(prefix)) label = p.display_name.slice(prefix.length);
      }
      groups[moduleKey] = { label, perms: [] };
    }
    groups[moduleKey].perms.push({ ...p, action });
  });
  Object.values(groups).forEach(g => {
    g.perms.sort((a, b) => ACTIONS.indexOf(a.action) - ACTIONS.indexOf(b.action));
  });
  return groups;
}

export default function AddRolePermission() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const presetRoleId = searchParams.get('roleId') || '';
  const currentUser  = useSelector(selectUser);
  const userType     = useSelector(selectUserType);

  const isEditing = Boolean(presetRoleId);

  // Filter form state — drives role list
  const [formUserType, setFormUserType] = useState(userType === 'organization' ? 'organization' : 'superadmin');
  const [formOrgId, setFormOrgId]       = useState(userType === 'organization' ? (currentUser?.orgId || '') : '');

  const [orgs, setOrgs]               = useState([]);
  const [roles, setRoles]             = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [roleId, setRoleId]           = useState(presetRoleId);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);

  // Fetch orgs and permissions once on mount
  useEffect(() => {
    apiServiceHandler('GET', 'organization/list-pagination?limit=1000')
      .then(r => setOrgs(Array.isArray(r?.data) ? r.data : []))
      .catch(() => {});
    apiServiceHandler('GET', 'permission/list')
      .then(r => setPermissions(Array.isArray(r?.data) ? r.data : []))
      .catch(() => {});
  }, []);

  // When editing, pre-populate formUserType/formOrgId from the role record
  useEffect(() => {
    if (!presetRoleId) return;
    apiServiceHandler('GET', `role/edit/${presetRoleId}`)
      .then(res => {
        const role = res?.data ?? res;
        if (role?.user_type) setFormUserType(role.user_type);
        if (role?.organizationId) {
          const orgId = role.organizationId?._id ?? role.organizationId;
          setFormOrgId(String(orgId));
        }
      })
      .catch(() => {});
  }, [presetRoleId]);

  // Fetch roles whenever user-type or org selection changes
  useEffect(() => {
    if (formUserType === 'organization' && !formOrgId) {
      setRoles([]);
      return;
    }
    const url = formUserType === 'organization'
      ? `role/list?user_type=organization&orgId=${formOrgId}`
      : 'role/list?user_type=superadmin';
    apiServiceHandler('GET', url)
      .then(r => setRoles(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setRoles([]));
  }, [formUserType, formOrgId]);

  // Pre-load existing permissions when editing
  useEffect(() => {
    if (!presetRoleId) return;
    apiServiceHandler('GET', `role-permission/by-role/${presetRoleId}`)
      .then(res => {
        const existing = Array.isArray(res?.data) ? res.data : [];
        const ids = new Set(
          existing.map(r => r.permission_id?._id?.toString() || r.permission_id?.toString()).filter(Boolean)
        );
        setSelectedIds(ids);
      })
      .catch(() => {});
  }, [presetRoleId]);

  function handleUserTypeChange(val) {
    setFormUserType(val);
    setFormOrgId('');
    if (!isEditing) { setRoleId(''); setSelectedIds(new Set()); }
  }

  function handleOrgChange(val) {
    setFormOrgId(val);
    if (!isEditing) { setRoleId(''); setSelectedIds(new Set()); }
  }

  const groups = useMemo(() => groupPermissions(permissions), [permissions]);
  const groupKeys = Object.keys(groups);

  function togglePerm(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleGroup(moduleKey) {
    const ids = groups[moduleKey].perms.map(p => p._id);
    const allChecked = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allChecked) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === permissions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(permissions.map(p => p._id)));
    }
  }

  function validate() {
    const e = {};
    if (formUserType === 'organization' && !formOrgId) e.formOrgId = 'Please select an organization.';
    if (!roleId) e.roleId = 'Please select a role.';
    if (selectedIds.size === 0) e.permissions = 'Select at least one permission.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await apiServiceHandler('POST', 'role-permission/assign', {
        role_id: roleId,
        permission_ids: [...selectedIds],
      });
      toast.success(isEditing
        ? 'Role permissions updated.'
        : `${selectedIds.size} permission${selectedIds.size !== 1 ? 's' : ''} assigned.`
      );
      router.push('/superadmin/role-permissions');
    } catch (err) {
      toast.warning(err?.message || 'Failed to assign permissions.');
    } finally {
      setSubmitting(false);
    }
  }

  const allSelected = permissions.length > 0 && selectedIds.size === permissions.length;

  return (
    <SuperAdminShell activeSection="assign-role">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/role-permissions')}>
        <BackArrow /> Back to Assign Role
      </button>
      <h1 className={s.pageTitle}>{isEditing ? 'Edit Role Permissions' : 'Assign Role'}</h1>
      <p className={s.pageSubtitle}>{isEditing ? 'Update permissions for this role' : 'Attach permissions to a role'}</p>

      <form onSubmit={handleSubmit} autoComplete="off">
        <div className={s.formCard}>
          <div className={s.formGrid}>

            {/* User Type */}
            <div className={s.formGroup}>
              <label>User Type <span className={s.required}>*</span></label>
              <select
                className={s.select}
                value={formUserType}
                onChange={e => handleUserTypeChange(e.target.value)}
                disabled={isEditing}
              >
                <option value="superadmin">Super Admin</option>
                <option value="organization">Organization</option>
              </select>
            </div>

            {/* Organization — only when user type is organization */}
            {formUserType === 'organization' && (
              <div className={s.formGroup}>
                <label>Organization <span className={s.required}>*</span></label>
                <select
                  className={s.select}
                  value={formOrgId}
                  onChange={e => handleOrgChange(e.target.value)}
                  disabled={isEditing}
                >
                  <option value="">— Select organization —</option>
                  {orgs.map(o => (
                    <option key={o._id} value={String(o._id)}>{o.org_name}</option>
                  ))}
                </select>
                {errors.formOrgId && <p className={s.errorMsg}>{errors.formOrgId}</p>}
              </div>
            )}

            {/* Role */}
            <div className={`${s.formGroup} ${formUserType !== 'organization' ? s.formGroupFull : ''}`}>
              <label>Role <span className={s.required}>*</span></label>
              <select
                className={s.select}
                value={roleId}
                onChange={e => setRoleId(e.target.value)}
                disabled={isEditing || (formUserType === 'organization' && !formOrgId)}
              >
                <option value="">— Select role —</option>
                {roles.map(r => (
                  <option key={r._id} value={r._id}>{r.display_name || r.name}</option>
                ))}
              </select>
              {errors.roleId && <p className={s.errorMsg}>{errors.roleId}</p>}
            </div>

          </div>
        </div>

        {permissions.length > 0 && (
          <>
            <div className={rp.permHeader}>
              <span className={rp.permTitle}>
                Permissions
                {selectedIds.size > 0 && (
                  <span className={rp.selectedCount}>{selectedIds.size} selected</span>
                )}
              </span>
              <label className={rp.selectAllLabel}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} autoComplete="off" />
                Select All
              </label>
            </div>
            {errors.permissions && <p className={s.errorMsg} style={{ marginBottom: 8 }}>{errors.permissions}</p>}

            <div className={rp.groupGrid}>
              {groupKeys.map(key => {
                const group = groups[key];
                const groupIds = group.perms.map(p => p._id);
                const allGroupChecked = groupIds.every(id => selectedIds.has(id));
                const someGroupChecked = groupIds.some(id => selectedIds.has(id));
                return (
                  <div key={key} className={rp.groupCard}>
                    <div className={rp.groupCardHeader}>
                      <span className={rp.groupCardTitle}>{group.label}</span>
                      <label className={rp.groupSelectAll}>
                        <input
                          type="checkbox"
                          checked={allGroupChecked}
                          ref={el => { if (el) el.indeterminate = someGroupChecked && !allGroupChecked; }}
                          onChange={() => toggleGroup(key)}
                          autoComplete="off"
                        />
                        All
                      </label>
                    </div>
                    <div className={rp.groupCardBody}>
                      {group.perms.map(p => (
                        <label key={p._id} className={rp.permItem}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(p._id)}
                            onChange={() => togglePerm(p._id)}
                            autoComplete="off"
                          />
                          <span className={rp.permAction}>{p.action || p.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {permissions.length === 0 && (
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
            No permissions available.{' '}
            <a href="/superadmin/permissions" style={{ color: '#0b7b7b' }}>Add permissions first.</a>
          </p>
        )}

        <div className={s.formActions} style={{ marginTop: 24 }}>
          <button className={s.btnSave} type="submit" disabled={submitting}>
            {submitting
              ? (isEditing ? 'Updating…' : 'Assigning…')
              : (isEditing ? 'Update Permissions' : `Assign Permission${selectedIds.size > 1 ? 's' : ''}`)
            }
          </button>
          <button type="button" className={s.btnCancel} onClick={() => router.push('/superadmin/role-permissions')}>
            Cancel
          </button>
        </div>
      </form>
    </SuperAdminShell>
  );
}
