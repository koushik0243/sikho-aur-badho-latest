'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from "./OrgAdminsList.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, PlusIcon, ResultCount, SkeletonRows, SortArrow, pageItems } from '../AdminKit/ListParts';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const SearchIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
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

const LIMIT = 50;

export default function OrgAdminsList() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const orgId       = searchParams.get('orgId') || '';

  const [admins, setAdmins]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [orgName, setOrgName]       = useState('');
  const [confirm, setConfirm]       = useState({ show: false, id: null });
  const [selected, setSelected]     = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [sortKey, setSortKey]       = useState('');
  const [sortDir, setSortDir]       = useState('asc');

  useEffect(() => {
    if (!orgId) return;
    apiServiceHandler('GET', `organization/view/${orgId}`)
      .then(res => setOrgName(res?.data?.org_name || ''))
      .catch(() => {});
  }, [orgId]);

  const fetchAdmins = useCallback(() => {
    if (!orgId) { setAdmins([]); setLoading(false); return; }
    setLoading(true);
    apiServiceHandler('GET', `user/admin/list-pagination?user_type=organization&orgRole=admin&orgId=${orgId}&deletedAt=null&limit=${LIMIT}&page=${page}`)
      .then(res => {
        const data = Array.isArray(res?.data) ? res.data : [];
        const records = data.filter(u => {
          const userOrgId = typeof u.orgId === 'object' ? u.orgId?._id : u.orgId;
          return u.user_type === 'organization'
            && u.orgRole === 'admin'
            && !u.deletedAt
            && String(userOrgId) === String(orgId);
        });
        setAdmins(records);
        setTotal(res?.total ?? records.length);
        setTotalPages(res?.totalPages ?? 1);
      })
      .catch(() => setAdmins([]))
      .finally(() => setLoading(false));
  }, [page, orgId]);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const filtered = search.trim()
    ? admins.filter(a =>
        (a.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.email || '').toLowerCase().includes(search.toLowerCase())
      )
    : admins;

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const isDate = ['createdAt', 'updatedAt', 'purchase_date', 'payment_date'].includes(sortKey);
        let av = a[sortKey] ?? ''; let bv = b[sortKey] ?? '';
        if (isDate) { av = new Date(av).getTime() || 0; bv = new Date(bv).getTime() || 0; }
        else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : filtered;

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function sortArrow(key) {
    return <SortArrow active={sortKey === key} dir={sortDir} />;
  }

  function doDelete() {
    const { id } = confirm;
    setConfirm({ show: false, id: null });
    apiServiceHandler('GET', `user/admin/delete/${id}`)
      .then(() => { toast.error('Admin deleted.'); fetchAdmins(); })
      .catch(() => toast.warning('Delete failed.'));
  }

  const backUrl  = `/superadmin/organizations`;
  const addUrl   = `/superadmin/organization-admins/add${orgId ? `?orgId=${orgId}` : ''}`;
  const editUrl  = (id) => `/superadmin/organization-admins/${id}/edit${orgId ? `?orgId=${orgId}` : ''}`;

  const allIds = sorted.map(a => a._id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.includes(id));
  const toggleAll = () => setSelected(allSelected ? [] : allIds);
  const toggleOne = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  function handleBulkDelete() { if (selected.length > 0) setBulkConfirm(true); }
  function doBulkDelete() {
    setBulkConfirm(false);
    const ids = [...selected];
    setSelected([]);
    Promise.all(ids.map(id => apiServiceHandler('GET', `user/admin/delete/${id}`)))
      .then(() => { toast.error(`${ids.length} admin${ids.length !== 1 ? 's' : ''} deleted.`); fetchAdmins(); })
      .catch(() => toast.warning('Some deletes failed'));
  }

  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  return (
    <SuperAdminShell activeSection="organizations">
      <ConfirmModal
        show={confirm.show}
        title="Delete Admin"
        message="Are you sure you want to delete this admin? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null })}
      />
      <ConfirmModal
        show={bulkConfirm}
        title="Delete Selected Admins"
        message={`Delete ${selected.length} selected admin${selected.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete All"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkConfirm(false)}
      />

      <div className={s.pageHeader} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div>
          <h1 className={s.pageTitle}>
            Organization Admins{orgName ? ` — ${orgName}` : ''}
          </h1>
          <p className={s.pageSubtitle}>Manage organization administrators</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 7, padding: '9px 16px', fontSize: 13, color: '#374151', cursor: 'pointer', fontWeight: 500 }}
            onClick={() => router.push(backUrl)}
          >
            ← Back
          </button>
          <button className={s.btnAdd} onClick={() => router.push(addUrl)}>
            <PlusIcon />
            Add Admin
          </button>
        </div>
      </div>

      <div className={s.card}>
        <div className={s.toolbar}>
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
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('name')}>Name{sortArrow('name')}</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('email')}>Email{sortArrow('email')}</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('createdAt')}>Created At{sortArrow('createdAt')}</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={8} />
              ) : sorted.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={8}><EmptyState>No admins found.</EmptyState></td></tr>
              ) : sorted.map((admin, idx) => (
                <tr key={admin._id} style={{ cursor: 'pointer' }} onClick={() => toggleOne(admin._id)}>
                  <td className={s.checkTd} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(admin._id)} onChange={() => toggleOne(admin._id)} />
                  </td>
                  <td>{(page - 1) * LIMIT + idx + 1}</td>
                  <td>{admin.name || '—'}</td>
                  <td>{admin.email || '—'}</td>
                  <td>{admin.user_role?.display_name || admin.user_role?.name || '—'}</td>
                  <td>
                    {admin.status === 'active'
                      ? <span className={s.badgeActive}>Active</span>
                      : <span className={s.badgeInactive}>Inactive</span>}
                  </td>
                  <td>{fmtDate(admin.createdAt)}</td>
                  <td>
                    <div className={s.actions} onClick={e => e.stopPropagation()}>
                      <button data-action="edit"
                        className={s.btnEdit}
                        title="Edit"
                        onClick={() => router.push(editUrl(admin._id))}
                      >
                        <EditIcon />
                      </button>
                      <button data-action="delete"
                        className={s.btnDelete}
                        title="Delete"
                        onClick={() => setConfirm({ show: true, id: admin._id })}
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
            <span><ResultCount from={from} to={to} total={total} singular="admin" plural="admins" /></span>
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
