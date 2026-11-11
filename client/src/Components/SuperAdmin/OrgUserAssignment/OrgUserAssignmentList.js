'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from "./OrgUserAssignmentList.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, ResultCount, SkeletonRows, SortArrow, pageItems } from '../AdminKit/ListParts';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);
const EyeIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
  </svg>
);
const LoginIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
  </svg>
);
const EditIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function displayName(u) {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || u.email || '—';
}

const LIMIT = 50;

export default function OrgUserAssignmentList() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const urlOrgId     = searchParams.get('orgId') ?? '';

  const [records, setRecords]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]               = useState(1);
  const [total, setTotal]             = useState(0);
  const [totalPages, setTotalPages]   = useState(1);
  const [confirm, setConfirm]         = useState({ show: false, id: null, name: '' });
  const [selected, setSelected]       = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [orgs, setOrgs]               = useState([]);
  const [orgFilter, setOrgFilter]     = useState(urlOrgId);
  const [sortKey, setSortKey]         = useState('');
  const [sortDir, setSortDir]         = useState('asc');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, orgFilter]);

  useEffect(() => {
    apiServiceHandler('GET', 'organization/list')
      .then(res => setOrgs(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const fetchRecords = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page,
      limit: LIMIT,
      user_type: 'employee',
      orgRole: 'employee',
      hasOrg: 'true',
    });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (orgFilter) params.set('orgId', orgFilter);
    apiServiceHandler('GET', `user/admin/list-pagination?${params}`)
      .then(res => {
        const data = Array.isArray(res?.data) ? res.data : [];
        const filtered = data.filter(u => {
          if (u.user_type !== 'employee') return false;
          if (!u.orgId) return false;
          if (u.orgRole !== 'employee') return false;
          if (u.deletedAt) return false;
          if (orgFilter) {
            const recordOrgId = typeof u.orgId === 'object' ? u.orgId?._id : u.orgId;
            if (String(recordOrgId) !== String(orgFilter)) return false;
          }
          return true;
        });
        setRecords(filtered);
        setTotal(res?.total ?? filtered.length);
        setTotalPages(res?.totalPages ?? 1);
      })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, orgFilter]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  function handleRemove(id, name) { setConfirm({ show: true, id, name }); }

  async function doRemove() {
    const { id } = confirm;
    setConfirm({ show: false, id: null, name: '' });
    try {
      await apiServiceHandler('PUT', `user/admin/update/${id}`, { orgId: null });
      toast.error('User removed from organization.');
      fetchRecords();
    } catch {
      toast.warning('Failed to remove user.');
    }
  }

  const allIds = records.map(u => u._id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.includes(id));
  const toggleAll = () => setSelected(allSelected ? [] : allIds);
  const toggleOne = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  function handleBulkRemove() { if (selected.length > 0) setBulkConfirm(true); }
  function doBulkRemove() {
    setBulkConfirm(false);
    const ids = [...selected];
    setSelected([]);
    Promise.all(ids.map(id => apiServiceHandler('PUT', `user/admin/update/${id}`, { orgId: null })))
      .then(() => { toast.error(`${ids.length} user${ids.length !== 1 ? 's' : ''} removed.`); fetchRecords(); })
      .catch(() => toast.warning('Some removals failed'));
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function sortArrow(key) {
    return <SortArrow active={sortKey === key} dir={sortDir} />;
  }

  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  const sorted = sortKey
    ? [...records].sort((a, b) => {
        const isDate = ['createdAt', 'updatedAt', 'purchase_date', 'payment_date'].includes(sortKey);
        let av = a[sortKey] ?? ''; let bv = b[sortKey] ?? '';
        if (isDate) { av = new Date(av).getTime() || 0; bv = new Date(bv).getTime() || 0; }
        else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : records;

  return (
    <SuperAdminShell activeSection="assign-user">
      <ConfirmModal
        show={confirm.show}
        title="Remove User Assignment"
        message={`Remove "${confirm.name || 'this user'}" from their organization? The user account will not be deleted.`}
        confirmLabel="Remove"
        onConfirm={doRemove}
        onCancel={() => setConfirm({ show: false, id: null, name: '' })}
      />
      <ConfirmModal
        show={bulkConfirm}
        title="Remove Selected Users"
        message={`Remove ${selected.length} selected user${selected.length !== 1 ? 's' : ''} from their organizations? User accounts will not be deleted.`}
        confirmLabel="Remove All"
        onConfirm={doBulkRemove}
        onCancel={() => setBulkConfirm(false)}
      />

      <div className={s.pageHeader} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div>
          <h1 className={s.pageTitle}>User Assignments</h1>
          <p className={s.pageSubtitle}>Employees assigned to organizations</p>
        </div>
        <button className={s.btnAdd} onClick={() => router.push(`/superadmin/organization-user-assignment/add${orgFilter ? `?orgId=${orgFilter}` : ''}`)}>
          + Assign Users
        </button>
      </div>

      <div className={s.card}>
        <div className={s.filterBar}>
          <select
            className={s.orgFilterSelect}
            value={orgFilter}
            onChange={e => { setOrgFilter(e.target.value); setPage(1); }}
            disabled={Boolean(urlOrgId)}
          >
            <option value="">All Organizations</option>
            {orgs.map(o => (
              <option key={o._id} value={o._id}>{o.org_name || o.name || '—'}</option>
            ))}
          </select>
          <div className={s.searchWrap}>
            <SearchIcon />
            <input
              className={s.searchInput}
              type="text"
              placeholder="Search by name or email…"
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
                <th>Organization</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('firstName')}>User{sortArrow('firstName')}</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('email')}>Email{sortArrow('email')}</th>
                <th>Status</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('createdAt')}>Assigned On{sortArrow('createdAt')}</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={8} />
              ) : records.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={8}><EmptyState>No assigned users found.</EmptyState></td></tr>
              ) : sorted.map((u, idx) => (
                <tr key={u._id} style={{ cursor: 'pointer' }} onClick={() => toggleOne(u._id)}>
                  <td className={s.checkTd} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(u._id)} onChange={() => toggleOne(u._id)} />
                  </td>
                  <td>{(page - 1) * LIMIT + idx + 1}</td>
                  <td>{u.orgId?.org_name || u.orgId?.name || '—'}</td>
                  <td>{displayName(u)}</td>
                  <td>{u.email || '—'}</td>
                  <td>
                    {u.status === 'active'
                      ? <span className={s.badgeActive}>Active</span>
                      : <span className={s.badgeInactive}>{u.status ?? 'Inactive'}</span>}
                  </td>
                  <td>{fmtDate(u.updatedAt || u.createdAt)}</td>
                  <td>
                    <div className={s.actions} onClick={e => e.stopPropagation()}>
                      <button data-action="view"
                        className={s.btnView}
                        title="View"
                        onClick={() => router.push(`/superadmin/organization-user-assignment/${u._id}`)}
                      >
                        <EyeIcon />
                      </button>
                      <button data-action="edit"
                        className={s.btnEdit}
                        title="Edit assignment"
                        onClick={() => router.push(`/superadmin/organization-user-assignment/edit/${u._id}`)}
                      >
                        <EditIcon />
                      </button>
                      <button data-action="delete"
                        className={s.btnRemove}
                        title="Remove from organization"
                        onClick={() => handleRemove(u._id, displayName(u))}
                      >
                        <TrashIcon />
                      </button>
                      {/* Log in as this learner — opens the learner dashboard in a new tab (this tab stays super admin) */}
                      <button data-action="login"
                        className={s.btnView}
                        title={u.status === 'active' ? 'Log in' : 'Log in (account not active)'}
                        aria-label={`Log in as ${displayName(u)} (opens a new tab)`}
                        disabled={u.status !== 'active'}
                        onClick={() => window.open(`/impersonate?userId=${u._id}`, '_blank', 'noopener')}
                      >
                        <LoginIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={s.tableFooter}>
          <div className={s.footerLeft}>
            {selected.length > 0 && (
              <button type="button" data-bulk-action="delete" className={s.btnBulkDelete} onClick={handleBulkRemove}>
                <TrashIcon />
                Remove Selected ({selected.length})
              </button>
            )}
            <span className={s.footerInfo}>
              <ResultCount from={from} to={to} total={total} singular="user" plural="users" />
            </span>
          </div>
          <div className={s.pagination}>
            <button className={s.pgBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </button>
            {pageItems(page, totalPages).map(p => typeof p !== 'number' ? <PageGap key={p} /> : (
              <button
                key={p}
                className={`${s.pgBtn}${page === p ? ` ${s.pgBtnActive}` : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button className={s.pgBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>
    </SuperAdminShell>
  );
}
