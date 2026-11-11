'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from './PaymentMethodsList.module.css';
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, PlusIcon, ResultCount, SkeletonRows, TrashIcon, pageItems } from '../AdminKit/ListParts';
import { orDash } from '../../../lib/displayValue';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const Icon = {
  search: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
    </svg>
  ),
  item: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
};

const BASE = '/superadmin/payment-methods';
const LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 350;

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

export default function PaymentMethodsList() {
  const router = useRouter();

  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [confirm, setConfirm]   = useState({ show: false, id: null });
  const [selected, setSelected] = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const fetchItems = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (debouncedSearch) params.set('search', debouncedSearch);
    apiServiceHandler('GET', `payment-method/list-pagination?${params}`)
      .then(res => {
        setItems(Array.isArray(res?.data) ? res.data : []);
        setTotal(res?.total ?? 0);
        setTotalPages(Math.max(1, res?.totalPages ?? 1));
      })
      .catch(() => { setItems([]); setTotal(0); setTotalPages(1); })
      .finally(() => setLoading(false));
  }, [page, debouncedSearch]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function doDelete() {
    const { id } = confirm;
    setConfirm({ show: false, id: null });
    apiServiceHandler('GET', `payment-method/delete/${id}`)
      .then(() => {
        toast.error('Payment method deleted.');
        setSelected(prev => prev.filter(x => x !== id));
        fetchItems();
      })
      .catch(() => toast.warning('Delete failed.'));
  }

  const allIds = items.map(item => String(item._id));
  const allSelected = allIds.length > 0 && allIds.every(id => selected.includes(id));
  const toggleAll = () => setSelected(allSelected ? [] : allIds);
  const toggleOne = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  function doBulkDelete() {
    setBulkConfirm(false);
    const ids = [...selected];
    setSelected([]);
    Promise.all(ids.map(id => apiServiceHandler('GET', `payment-method/delete/${id}`)))
      .then(() => { toast.error(`${ids.length} payment method${ids.length !== 1 ? 's' : ''} deleted.`); fetchItems(); })
      .catch(() => { toast.warning('Some deletes failed'); fetchItems(); });
  }

  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  return (
    <SuperAdminShell activeSection="manage-payment-method">
      <ConfirmModal
        show={confirm.show}
        title="Delete Payment Method"
        message="Are you sure you want to delete this payment method?"
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null })}
      />
      <ConfirmModal
        show={bulkConfirm}
        title="Delete Selected Payment Methods"
        message={`Delete ${selected.length} selected payment method${selected.length !== 1 ? 's' : ''}?`}
        confirmLabel="Delete All"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkConfirm(false)}
      />

      <div className={s.pageHeader} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div>
          <h1 className={s.pageTitle}>Payment Methods</h1>
          <p className={s.pageSubtitle}>Manage payment methods</p>
        </div>
        <button className={s.btnAdd} onClick={() => router.push(`${BASE}/add`)}>
          <PlusIcon />
          Add Payment Method
        </button>
      </div>

      <div className={s.card}>
        <div className={s.searchWrap}>
          {Icon.search}
          <input
            className={s.searchInput}
            type="text"
            placeholder="Search by payment method name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.checkTh}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" /></th>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={6} />
              ) : items.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={6}><EmptyState>{debouncedSearch ? 'No payment methods match your search.' : 'No payment methods yet.'}</EmptyState></td></tr>
              ) : items.map(item => {
                const id = String(item._id);
                return (
                  <tr key={id} style={{ cursor: 'pointer' }} onClick={() => toggleOne(id)}>
                    <td className={s.checkTd} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(id)} onChange={() => toggleOne(id)} aria-label={`Select ${item.name}`} />
                    </td>
                    <td>
                      <div className={s.nameCell}>
                        <span className={s.catName}>{orDash(item.name)}</span>
                      </div>
                    </td>
                    <td className={s.descCell}>{item.description || '—'}</td>
                    <td>
                      {item.status === 'active'
                        ? <span className={s.badgeActive}>Active</span>
                        : <span className={s.badgeInactive}>Inactive</span>}
                    </td>
                    <td>{fmtDate(item.createdAt)}</td>
                    <td>
                      <div className={s.actions} onClick={e => e.stopPropagation()}>
                        <button data-action="view" className={s.btnView} title="View" onClick={() => router.push(`${BASE}/${id}`)}>
                          {Icon.eye}
                        </button>
                        <button data-action="edit" className={s.btnEdit} title="Edit" onClick={() => router.push(`${BASE}/${id}/edit`)}>
                          {Icon.edit}
                        </button>
                        <button data-action="delete" className={s.btnDelete} title="Delete" onClick={() => setConfirm({ show: true, id })}>
                          {Icon.trash}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={s.paginationWrap}>
          <div className={s.footerLeft}>
            {selected.length > 0 && (
              <button type="button" data-bulk-action="delete" className={s.btnBulkDelete} onClick={() => setBulkConfirm(true)}>
                <TrashIcon />
                Delete Selected ({selected.length})
              </button>
            )}
            <span className={s.paginInfo}>
              <ResultCount from={from} to={to} total={total} singular="payment method" plural="payment methods" />
            </span>
          </div>
          <div className={s.paginBtns}>
            <button className={s.paginBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            {pageItems(page, totalPages).map(n => typeof n !== 'number' ? <PageGap key={n} /> : (
              <button key={n}
                className={`${s.paginBtn} ${page === n ? s.paginBtnActive : ''}`}
                onClick={() => setPage(n)}>
                {n}
              </button>
            ))}
            <button className={s.paginBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      </div>
    </SuperAdminShell>
  );
}
