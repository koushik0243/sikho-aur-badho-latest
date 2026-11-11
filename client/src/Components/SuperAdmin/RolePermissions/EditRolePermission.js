'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import sPage from "./EditRolePermission.module.css";
import rpPage from "./EditRolePermission.module.css";
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

export default function EditRolePermission() {
  const router = useRouter();
  const { id } = useParams();

  const [roleName, setRoleName]       = useState('');
  const [roleId, setRoleId]           = useState('');
  const [permissions, setPermissions] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [assignedMap, setAssignedMap] = useState({}); // permId → rp record _id
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiServiceHandler('GET', `role-permission/edit/${id}`).then(r => r?.data ?? r).catch(() => null),
      apiServiceHandler('GET', 'permission/list').then(r => Array.isArray(r?.data) ? r.data : []).catch(() => []),
    ]).then(async ([record, allPerms]) => {
      if (!record?._id) { setLoading(false); return; }
      const rId = record.role_id?._id || String(record.role_id || '');
      const rName = record.role_id?.name || '';
      setRoleId(rId);
      setRoleName(rName);
      setPermissions(allPerms);

      // Fetch all existing assignments for this role
      const existing = await apiServiceHandler('GET', `role-permission/list-pagination?limit=1000`)
        .then(r => Array.isArray(r?.data) ? r.data : [])
        .catch(() => []);

      const forRole = existing.filter(rp => {
        const rpRoleId = rp.role_id?._id || String(rp.role_id || '');
        return rpRoleId === rId;
      });

      const map = {};
      const checked = new Set();
      forRole.forEach(rp => {
        const permId = rp.permission_id?._id || String(rp.permission_id || '');
        map[permId] = rp._id;
        checked.add(permId);
      });
      setAssignedMap(map);
      setSelectedIds(checked);
    }).finally(() => setLoading(false));
  }, [id]);

  const groups = useMemo(() => groupPermissions(permissions), [permissions]);
  const groupKeys = Object.keys(groups);

  function togglePerm(permId) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(permId) ? next.delete(permId) : next.add(permId);
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

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const toAdd    = [...selectedIds].filter(permId => !assignedMap[permId]);
      const toRemove = Object.keys(assignedMap).filter(permId => !selectedIds.has(permId));

      await Promise.all([
        ...toAdd.map(permId =>
          apiServiceHandler('POST', 'role-permission/create', { role_id: roleId, permission_id: permId, status: 'active' })
        ),
        ...toRemove.map(permId =>
          apiServiceHandler('GET', `role-permission/delete/${assignedMap[permId]}`)
        ),
      ]);

      toast.success('Role permissions updated.');
      router.push('/superadmin/role-permissions');
    } catch (err) {
      toast.warning(err?.message || 'Failed to update permissions.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <SuperAdminShell activeSection="assign-role"><p style={{ padding: 40, color: '#6b7280' }}>Loading…</p></SuperAdminShell>;
  }

  const allSelected = permissions.length > 0 && selectedIds.size === permissions.length;

  return (
    <SuperAdminShell activeSection="assign-role">
      <button className={s.backBtn} onClick={() => router.push('/superadmin/role-permissions')}>
        <BackArrow /> Back to Assign Role
      </button>
      <h1 className={s.pageTitle}>Edit Role Permissions</h1>
      <p className={s.pageSubtitle}>Manage permissions for <strong>{roleName || 'this role'}</strong></p>

      <form onSubmit={handleSubmit} autoComplete="off">
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
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>No permissions available.</p>
        )}

        <div className={s.formActions} style={{ marginTop: 24 }}>
          <button className={s.btnSave} type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" className={s.btnCancel} onClick={() => router.push('/superadmin/role-permissions')}>
            Cancel
          </button>
        </div>
      </form>
    </SuperAdminShell>
  );
}
