'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from "./RolesList.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, PlusIcon, ResultCount, SkeletonRows, SortArrow, pageItems } from '../AdminKit/ListParts';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const SearchIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
  </svg>
);
const EyeIcon = () => (
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

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function toTypeLabel(val) {
  if (!val) return '—';
  if (val === 'superadmin') return 'Super Admin';
  if (val === 'organization') return 'Organization';
  return val;
}

const LIMIT = 50;

export default function RolesList() {
  const router = useRouter();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [confirm, setConfirm] = useState({ show: false, id: null });
  const [selected, setSelected] = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, sortKey, sortDir]);

  const fetchRoles = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (debouncedSearch) params.set('search', debouncedSearch);
    apiServiceHandler('GET', `role/list-pagination?${params}`)
      .then(res => {
        setRoles(Array.isArray(res?.data) ? res.data : []);
        setTotal(res?.total ?? 0);
        setTotalPages(res?.totalPages ?? 1);
      })
      .catch(() => setRoles([]))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function sortArrow(key) {
    return <SortArrow active={sortKey === key} dir={sortDir} />;
  }

  const filtered = debouncedSearch
    ? roles.filter(r =>
        (r.name || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (r.display_name || '').toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : roles;

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        if (sortKey === 'org_name') {
          const av = (a.organizationId?.org_name ?? '').toLowerCase();
          const bv = (b.organizationId?.org_name ?? '').toLowerCase();
          if (av < bv) return sortDir === 'asc' ? -1 : 1;
          if (av > bv) return sortDir === 'asc' ? 1 : -1;
          return 0;
        }
        const isDate = ['createdAt', 'updatedAt', 'purchase_date', 'payment_date'].includes(sortKey);
        let av = a[sortKey] ?? ''; let bv = b[sortKey] ?? '';
        if (isDate) { av = new Date(av).getTime() || 0; bv = new Date(bv).getTime() || 0; }
        else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : filtered;

  function doDelete() {
    const id = confirm.id;
    setConfirm({ show: false, id: null });
    apiServiceHandler('GET', `role/delete/${id}`)
      .then(() => { toast.error('Role deleted.'); fetchRoles(); })
      .catch(() => toast.warning('Delete failed.'));
  }

  const allIds = sorted.map(r => r._id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.includes(id));
  const toggleAll = () => setSelected(allSelected ? [] : allIds);
  const toggleOne = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  function handleBulkDelete() { if (selected.length > 0) setBulkConfirm(true); }
  function doBulkDelete() {
    setBulkConfirm(false);
    const ids = [...selected];
    setSelected([]);
    Promise.all(ids.map(id => apiServiceHandler('GET', `role/delete/${id}`)))
      .then(() => { toast.error(`${ids.length} role${ids.length !== 1 ? 's' : ''} deleted.`); fetchRoles(); })
      .catch(() => toast.warning('Some deletes failed'));
  }

  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  return (
    <SuperAdminShell activeSection="roles">
      <ConfirmModal
        show={confirm.show}
        title="Delete Role"
        message="Are you sure you want to delete this role?"
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null })}
      />
      <ConfirmModal
        show={bulkConfirm}
        title="Delete Selected Roles"
        message={`Delete ${selected.length} selected role${selected.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete All"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkConfirm(false)}
      />

      <div className={s.pageHeader} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div>
          <h1 className={s.pageTitle}>Roles</h1>
          <p className={s.pageSubtitle}>Manage system roles</p>
        </div>
        <button className={s.btnAdd} onClick={() => router.push('/superadmin/roles/add')}>
          <PlusIcon />
          Add Role
        </button>
      </div>

      <div className={s.card}>
        <div className={s.toolbar}>
          <div className={s.searchWrap}>
            <SearchIcon />
            <input
              className={s.searchInput}
              type="text"
              placeholder="Search by name…"
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
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('name')}>Name{sortArrow('name')}</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('display_name')}>Display Name{sortArrow('display_name')}</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('user_type')}>Created By{sortArrow('user_type')}</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('org_name')}>Organization{sortArrow('org_name')}</th>
                <th>Status</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('createdAt')}>Created At{sortArrow('createdAt')}</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={9} />
              ) : sorted.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={9}><EmptyState>No roles found.</EmptyState></td></tr>
              ) : sorted.map((r, idx) => (
                <tr key={r._id} style={{ cursor: 'pointer' }} onClick={() => toggleOne(r._id)}>
                  <td className={s.checkTd} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(r._id)} onChange={() => toggleOne(r._id)} />
                  </td>
                  <td>{(page - 1) * LIMIT + idx + 1}</td>
                  <td>{r.name}</td>
                  <td>{r.display_name || '—'}</td>
                  <td>{toTypeLabel(r.user_type)}</td>
                  <td>{r.organizationId?.org_name || '—'}</td>
                  <td>
                    {r.status === 'active'
                      ? <span className={s.badgeActive}>Active</span>
                      : <span className={s.badgeInactive}>Inactive</span>}
                  </td>
                  <td>{fmtDate(r.createdAt)}</td>
                  <td>
                    <div className={s.actions} onClick={e => e.stopPropagation()}>
                      <button data-action="view"
                        className={s.btnView}
                        title="View"
                        onClick={() => router.push(`/superadmin/roles/${r._id}`)}
                      >
                        <EyeIcon />
                      </button>
                      <button data-action="edit"
                        className={s.btnEdit}
                        title="Edit"
                        onClick={() => router.push(`/superadmin/roles/${r._id}/edit`)}
                      >
                        <EditIcon />
                      </button>
                      <button data-action="delete"
                        className={s.btnDelete}
                        title="Delete"
                        onClick={() => setConfirm({ show: true, id: r._id })}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={s.pagination}>
          <div className={s.footerLeft}>
            {selected.length > 0 && (
              <button type="button" data-bulk-action="delete" className={s.btnBulkDelete} onClick={handleBulkDelete}>
                <TrashIcon />
                Delete Selected ({selected.length})
              </button>
            )}
            <span><ResultCount from={from} to={to} total={total} singular="role" plural="roles" /></span>
          </div>
          <div className={s.paginationBtns}>
            <button className={s.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            {pageItems(page, totalPages).map(p => typeof p !== 'number' ? <PageGap key={p} /> : (
              <button
                key={p}
                className={`${s.pageBtn} ${p === page ? s.pageBtnActive : ''}`}
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
