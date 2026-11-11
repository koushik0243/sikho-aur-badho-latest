'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from "./CreditsList.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, PlusIcon, ResultCount, SkeletonRows, SortArrow, pageItems } from '../AdminKit/ListParts';
import { orDash } from '../../../lib/displayValue';

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

function fmtPrice(val) {
  if (val === null || val === undefined) return '—';
  const n = val?.$numberDecimal ?? val;
  return `${parseFloat(n).toFixed(2)}`;
}

const LIMIT = 50;

export default function CreditsList() {
  const router = useRouter();
  const [credits, setCredits] = useState([]);
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

  const fetchCredits = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    apiServiceHandler('GET', `credit/list-pagination?${params}`)
      .then(res => {
        setCredits(Array.isArray(res?.data) ? res.data : []);
        setTotal(res?.total ?? 0);
        setTotalPages(res?.totalPages ?? 1);
      })
      .catch(() => setCredits([]))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { fetchCredits(); }, [fetchCredits]);

  // Client-side filter by title (server doesn't support search param)
  const filtered = debouncedSearch
    ? credits.filter(c => (c.title || '').toLowerCase().includes(debouncedSearch.toLowerCase()))
    : credits;

  function doDelete() {
    const id = confirm.id;
    setConfirm({ show: false, id: null });
    apiServiceHandler('GET', `credit/delete/${id}`)
      .then(() => { toast.warning('Credit deleted.'); fetchCredits(); })
      .catch(() => toast.warning('Delete failed.'));
  }

  const allIds = filtered.map(c => c._id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.includes(id));
  const toggleAll = () => setSelected(allSelected ? [] : allIds);
  const toggleOne = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  function handleBulkDelete() { if (selected.length > 0) setBulkConfirm(true); }
  function doBulkDelete() {
    setBulkConfirm(false);
    const ids = [...selected];
    setSelected([]);
    Promise.all(ids.map(id => apiServiceHandler('GET', `credit/delete/${id}`)))
      .then(() => { toast.error(`${ids.length} credit${ids.length !== 1 ? 's' : ''} deleted.`); fetchCredits(); })
      .catch(() => toast.warning('Some deletes failed'));
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function sortArrow(key) {
    return <SortArrow active={sortKey === key} dir={sortDir} />;
  }

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        if (sortKey === 'limit_from') {
          return sortDir === 'asc' ? (Number(a.limit_from)||0) - (Number(b.limit_from)||0) : (Number(b.limit_from)||0) - (Number(a.limit_from)||0);
        }
        if (sortKey === 'price') {
          const av = parseFloat(a.price?.$numberDecimal ?? a.price ?? 0) || 0;
          const bv = parseFloat(b.price?.$numberDecimal ?? b.price ?? 0) || 0;
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        const isDate = ['createdAt','updatedAt','purchase_date','payment_date'].includes(sortKey);
        let av = a[sortKey] ?? ''; let bv = b[sortKey] ?? '';
        if (isDate) { av = new Date(av).getTime()||0; bv = new Date(bv).getTime()||0; }
        else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : filtered;

  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  return (
    <SuperAdminShell activeSection="manage-credit">
      <ConfirmModal
        show={confirm.show}
        title="Delete Credit"
        message="Are you sure you want to delete this credit?"
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null })}
      />
      <ConfirmModal
        show={bulkConfirm}
        title="Delete Selected Credits"
        message={`Delete ${selected.length} selected credit${selected.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete All"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkConfirm(false)}
      />

      <div className={s.pageHeader} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div>
          <h1 className={s.pageTitle}>Credits</h1>
          <p className={s.pageSubtitle}>Manage credits</p>
        </div>
        <button className={s.btnAdd} onClick={() => router.push('/superadmin/credits/add')}>
          <PlusIcon />
          Add Credit
        </button>
      </div>

      <div className={s.card}>
        <div className={s.toolbar}>
          <div className={s.searchWrap}>
            <SearchIcon />
            <input
              className={s.searchInput}
              type="text"
              placeholder="Search by title…"
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
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('title')}>Title{sortArrow('title')}</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('limit_from')}>Limits{sortArrow('limit_from')}</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('price')}>Price{sortArrow('price')}</th>
                <th>Status</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('createdAt')}>Created At{sortArrow('createdAt')}</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={8} />
              ) : filtered.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={8}><EmptyState>No credits found.</EmptyState></td></tr>
              ) : sorted.map((c, idx) => (
                <tr key={c._id} style={{ cursor: 'pointer' }} onClick={() => toggleOne(c._id)}>
                  <td className={s.checkTd} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(c._id)} onChange={() => toggleOne(c._id)} />
                  </td>
                  <td>{(page - 1) * LIMIT + idx + 1}</td>
                  <td>{c.title}</td>
                  <td>{c.limit_from ?? 0} - {orDash(c.limit_to)}</td>
                  <td>{fmtPrice(c.price)}</td>
                  <td>
                    {c.status === 'active'
                      ? <span className={s.badgeActive}>Active</span>
                      : <span className={s.badgeInactive}>Inactive</span>}
                  </td>
                  <td>{fmtDate(c.createdAt)}</td>
                  <td>
                    <div className={s.actions} onClick={e => e.stopPropagation()}>
                      <button data-action="edit"
                        className={s.btnEdit}
                        title="Edit"
                        onClick={() => router.push(`/superadmin/credits/${c._id}`)}
                      >
                        <EditIcon />
                      </button>
                      <button data-action="delete"
                        className={s.btnDelete}
                        title="Delete"
                        onClick={() => setConfirm({ show: true, id: c._id })}
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
            <span><ResultCount from={from} to={to} total={total} singular="credit package" plural="credit packages" /></span>
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
