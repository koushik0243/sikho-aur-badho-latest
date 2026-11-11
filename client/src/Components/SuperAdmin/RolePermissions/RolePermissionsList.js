'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from "./RolePermissionsList.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, ResultCount, SkeletonRows, SortArrow, pageItems } from '../AdminKit/ListParts';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const SearchIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
  </svg>
);
const ViewIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
  </svg>
);
const EditIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

/* ── Permission label helpers ───────────────────────────────────────────── */
const ACTIONS = ['add', 'edit', 'delete', 'view'];

function parsePermission(perm) {
  const name = perm?.name || '';
  for (const action of ACTIONS) {
    if (name.startsWith(action + '_')) {
      const moduleKey   = name.slice(action.length + 1);
      const moduleLabel = moduleKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return { action, moduleKey, moduleLabel };
    }
  }
  const moduleLabel = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return { action: null, moduleKey: name, moduleLabel };
}

function buildPermissionsLabel(permDocs) {
  const perms = permDocs.filter(Boolean);
  if (perms.length === 0) return '—';

  const modules = {};
  perms.forEach(p => {
    const { action, moduleKey, moduleLabel } = parsePermission(p);
    if (!modules[moduleKey]) modules[moduleKey] = { label: moduleLabel, actions: [] };
    if (action) modules[moduleKey].actions.push(action);
  });

  const parts = [];
  Object.values(modules).forEach(({ label, actions }) => {
    const unique = [...new Set(actions)];
    const hasAll = ACTIONS.every(a => unique.includes(a));
    if (hasAll || unique.length === 0) {
      parts.push(label);
    } else {
      unique
        .sort((a, b) => ACTIONS.indexOf(a) - ACTIONS.indexOf(b))
        .forEach(action => parts.push(`${label} - ${action.charAt(0).toUpperCase() + action.slice(1)}`));
    }
  });

  return parts.join(', ') || '—';
}

/* ── Badges ─────────────────────────────────────────────────────────────── */
const TYPE_LABEL = {
  superadmin:   'Super Admin',
  organization: 'Organization',
};

function TypeBadge({ userType }) {
  const label = TYPE_LABEL[userType] || userType || '—';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 0', borderRadius: 20,
      fontSize: 11.5, fontWeight: 400, background: 'transparent', color: '#000',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

const LIMIT = 50;

/* ── Component ──────────────────────────────────────────────────────────── */
export default function RolePermissionsList() {
  const router = useRouter();

  const [allRecords, setAllRecords]   = useState([]);
  const [orgMap, setOrgMap]           = useState({});      // orgId → org_name
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]   = useState('');      // '' | 'superadmin' | 'organization'
  const [page, setPage]               = useState(1);
  const [confirm, setConfirm]         = useState({ show: false, roleId: null });
  const [selected, setSelected]       = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  // Load orgs for name lookup
  useEffect(() => {
    apiServiceHandler('GET', 'organization/list')
      .then(res => {
        const map = {};
        (Array.isArray(res?.data) ? res.data : []).forEach(o => {
          map[String(o._id)] = o.org_name || o.name || '—';
        });
        setOrgMap(map);
      })
      .catch(() => {});
  }, []);

  const fetchRecords = useCallback(() => {
    setLoading(true);
    apiServiceHandler('GET', 'role-permission/list')
      .then(res => setAllRecords(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setAllRecords([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Group flat records → one entry per role
  const grouped = useMemo(() => {
    const map = {};
    allRecords.forEach(r => {
      const roleId = r.role_id?._id?.toString();
      if (!roleId) return;
      if (!map[roleId]) {
        map[roleId] = {
          roleId,
          firstRecordId: r._id,
          roleName:     r.role_id?.display_name || r.role_id?.name || '—',
          roleUserType: r.role_id?.user_type || 'superadmin',
          roleOrgId:    r.role_id?.organizationId?.toString() || null,
          permissions:  [],
        };
      }
      if (r.permission_id) map[roleId].permissions.push(r.permission_id);
    });
    return Object.values(map);
  }, [allRecords]);

  const rows = useMemo(() => {
    let result = grouped;

    if (typeFilter) {
      result = result.filter(g => g.roleUserType === typeFilter);
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(g => {
        const orgName = g.roleOrgId ? (orgMap[g.roleOrgId] || '') : '';
        return (
          g.roleName.toLowerCase().includes(term) ||
          buildPermissionsLabel(g.permissions).toLowerCase().includes(term) ||
          g.roleUserType.toLowerCase().includes(term) ||
          orgName.toLowerCase().includes(term)
        );
      });
    }

    return result;
  }, [grouped, search, typeFilter, orgMap]);

  useEffect(() => { setPage(1); }, [search, typeFilter, sortKey, sortDir]);

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        let av, bv;
        if (sortKey === 'roleOrgName') {
          av = (a.roleOrgId ? (orgMap[a.roleOrgId] || '') : '').toLowerCase();
          bv = (b.roleOrgId ? (orgMap[b.roleOrgId] || '') : '').toLowerCase();
        } else {
          av = String(a[sortKey] ?? '').toLowerCase();
          bv = String(b[sortKey] ?? '').toLowerCase();
        }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : rows;

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function sortArrow(key) {
    return <SortArrow active={sortKey === key} dir={sortDir} />;
  }

  const totalRows  = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / LIMIT));
  const pagedRows  = sorted.slice((page - 1) * LIMIT, page * LIMIT);
  const from = totalRows === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, totalRows);

  function doDelete() {
    const { roleId } = confirm;
    setConfirm({ show: false, roleId: null });
    apiServiceHandler('POST', 'role-permission/assign', { role_id: roleId, permission_ids: [] })
      .then(() => { toast.error('Role permissions removed.'); fetchRecords(); })
      .catch(() => toast.warning('Delete failed.'));
  }

  const allIds      = pagedRows.map(r => r.roleId);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.includes(id));
  const toggleAll   = () => setSelected(allSelected ? [] : allIds);
  const toggleOne   = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  function handleBulkDelete() { if (selected.length > 0) setBulkConfirm(true); }
  function doBulkDelete() {
    setBulkConfirm(false);
    const ids = [...selected];
    setSelected([]);
    Promise.all(ids.map(roleId =>
      apiServiceHandler('POST', 'role-permission/assign', { role_id: roleId, permission_ids: [] })
    ))
      .then(() => { toast.error(`${ids.length} role${ids.length !== 1 ? 's' : ''} cleared.`); fetchRecords(); })
      .catch(() => toast.warning('Some removals failed'));
  }

  return (
    <SuperAdminShell activeSection="assign-role">
      <ConfirmModal
        show={confirm.show}
        title="Remove Role Permissions"
        message="This will remove all permissions assigned to this role. This action cannot be undone."
        confirmLabel="Remove"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, roleId: null })}
      />
      <ConfirmModal
        show={bulkConfirm}
        title="Remove Selected Role Permissions"
        message={`Remove all permissions from ${selected.length} selected role${selected.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Remove All"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkConfirm(false)}
      />

      <div className={s.pageHeader} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div>
          <h1 className={s.pageTitle}>Assign Role</h1>
          <p className={s.pageSubtitle}>Manage role-permission assignments</p>
        </div>
        <button className={s.btnAdd} onClick={() => router.push('/superadmin/role-permissions/add')}>
          + Assign Role
        </button>
      </div>

      <div className={s.card}>
        <div className={s.toolbar}>
          {/* User Type filter */}
          <select
            className={s.filterSelect}
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="">All User Types</option>
            <option value="superadmin">Super Admin</option>
            <option value="organization">Organization</option>
          </select>

          {/* Search */}
          <div className={s.searchWrap}>
            <SearchIcon />
            <input
              className={s.searchInput}
              type="text"
              placeholder="Search by role, permission, org…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.checkTh}><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                <th>#</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('roleName')}>Role{sortArrow('roleName')}</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('roleUserType')}>User Type{sortArrow('roleUserType')}</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('roleOrgName')}>Organization{sortArrow('roleOrgName')}</th>
                <th>Permissions</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={7} />
              ) : rows.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={7}><EmptyState>No assignments found.</EmptyState></td></tr>
              ) : pagedRows.map((row, idx) => {
                const orgName = row.roleOrgId ? (orgMap[row.roleOrgId] || row.roleOrgId) : '—';
                return (
                  <tr key={row.roleId} style={{ cursor: 'pointer' }} onClick={() => toggleOne(row.roleId)}>
                    <td className={s.checkTd} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(row.roleId)} onChange={() => toggleOne(row.roleId)} />
                    </td>
                    <td>{(page - 1) * LIMIT + idx + 1}</td>
                    <td><strong>{row.roleName}</strong></td>
                    <td><TypeBadge userType={row.roleUserType} /></td>
                    <td style={{ color: orgName === '—' ? '#9ca3af' : '#111827', fontSize: 13 }}>{orgName}</td>
                    <td className={s.permCell}>{buildPermissionsLabel(row.permissions)}</td>
                    <td>
                      <div className={s.actions} onClick={e => e.stopPropagation()}>
                        <button data-action="view"
                          className={s.btnView}
                          title="View"
                          onClick={() => router.push(`/superadmin/role-permissions/${row.firstRecordId}`)}
                        >
                          <ViewIcon />
                        </button>
                        <button data-action="edit"
                          className={s.btnEdit}
                          title="Edit"
                          onClick={() => router.push(`/superadmin/role-permissions/add?roleId=${row.roleId}`)}
                        >
                          <EditIcon />
                        </button>
                        <button data-action="delete"
                          className={s.btnDelete}
                          title="Delete"
                          onClick={() => setConfirm({ show: true, roleId: row.roleId })}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={s.pagination}>
          <div>
            {selected.length > 0 ? (
              <button type="button" data-bulk-action="delete" className={s.btnBulkDelete} onClick={handleBulkDelete}>
                <TrashIcon />
                Remove Selected ({selected.length})
              </button>
            ) : (
              <span><ResultCount from={from} to={to} total={totalRows} singular="role" plural="roles" /></span>
            )}
          </div>
          <div className={s.paginationBtns}>
            <button className={s.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            {pageItems(page, totalPages).map(p => typeof p !== 'number' ? <PageGap key={p} /> : (
              <button
                key={p}
                className={`${s.pageBtn}${page === p ? ` ${s.pageBtnActive}` : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button className={s.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      </div>
    </SuperAdminShell>
  );
}
