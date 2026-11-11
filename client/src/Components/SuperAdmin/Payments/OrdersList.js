'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from "./OrdersList.module.css";
import ListFilterBar, { EMPTY_LIST_FILTERS, isDateRangeInvalid, listFilterParams } from '../ListFilterBar';
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, PlusIcon, ResultCount, SkeletonRows, SortArrow, pageItems } from '../AdminKit/ListParts';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const EyeIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
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

function fmtAmount(val) {
  if (val === null || val === undefined) return '—';
  return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const LIMIT = 50;

const STATUSES = [
  { value: 'success',  label: 'Success',  cls: 'badgeSuccess' },
  { value: 'pending',  label: 'Pending',  cls: 'badgePending' },
  { value: 'failed',   label: 'Failed',   cls: 'badgeFailed' },
  { value: 'canceled', label: 'Canceled', cls: 'badgeCanceled' },
  { value: 'refunded', label: 'Refunded', cls: 'badgeRefunded' },
];
const STATUS_BY_VALUE = Object.fromEntries(STATUSES.map(st => [st.value, st]));

const time = v => new Date(v).getTime() || 0;

/** List order: by the clicked column, otherwise most recent purchase first. */
function compareOrders(key, dir) {
  const sign = dir === 'asc' ? 1 : -1;
  const pick = {
    org_name:        o => (o.organizer_id?.org_name ?? '').toLowerCase(),
    credit_title:    o => (o.credit_id?.title ?? '').toLowerCase(),
    credit_amount:   o => Number(o.credit_amount) || 0,
    purchase_date:   o => time(o.purchase_date),
    payment_gateway: o => String(o.payment_gateway || '').toLowerCase(),
  }[key];
  if (!pick) return (a, b) => (time(b.purchase_date) - time(a.purchase_date)) || (time(b.createdAt) - time(a.createdAt));
  return (a, b) => { const av = pick(a), bv = pick(b); return av < bv ? -sign : av > bv ? sign : 0; };
}

function StatusBadge({ status }) {
  const st = STATUS_BY_VALUE[status];
  return st
    ? <span className={s[st.cls]}>{st.label}</span>
    : <span className={s.badgePending} style={{ textTransform: 'capitalize' }}>{status || 'Pending'}</span>;
}

export default function OrdersList() {
  const router = useRouter();
  const [loaded, setLoaded]         = useState({ key: null, orders: [] });   // orders for one query
  const [reloadToken, setReloadToken] = useState(0);
  const [orgs, setOrgs]             = useState([]);
  const [filters, setFilters]       = useState(EMPTY_LIST_FILTERS);
  const [page, setPage]             = useState(1);
  const [confirm, setConfirm]       = useState({ show: false, id: null });
  const [selected, setSelected]     = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [sortKey, setSortKey]       = useState('');
  const [sortDir, setSortDir]       = useState('asc');

  const dateRangeInvalid = isDateRangeInvalid(filters);

  // Every order matching the filters (filtered on the server); sorted and paged here.
  const queryKey = `${listFilterParams(filters, { orgParam: 'organizer_id', statusParam: 'status' })}#${reloadToken}`;
  const loading = !dateRangeInvalid && loaded.key !== queryKey;
  const orders = loaded.orders;

  useEffect(() => {
    if (dateRangeInvalid) return undefined;
    let cancelled = false;
    const [query] = queryKey.split('#');
    apiServiceHandler('GET', `order/list?${query}${query ? '&' : ''}t=${Date.now()}`)
      .then(res => { if (!cancelled) setLoaded({ key: queryKey, orders: Array.isArray(res?.data) ? res.data : [] }); })
      .catch(() => {
        if (cancelled) return;
        setLoaded({ key: queryKey, orders: [] });
        toast.warning('Failed to load orders.');
      });
    return () => { cancelled = true; };
  }, [queryKey, dateRangeInvalid]);

  const fetchOrders = () => setReloadToken(n => n + 1);

  useEffect(() => {
    apiServiceHandler('GET', 'organization/list-pagination?limit=1000')
      .then(res => setOrgs(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setOrgs([]));
  }, []);

  function setFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
    setSelected([]);
  }
  function resetFilters() {
    setFilters(EMPTY_LIST_FILTERS);
    setPage(1);
    setSelected([]);
  }
  const hasFilters = Object.values(filters).some(Boolean);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function sortArrow(key) {
    return <SortArrow active={sortKey === key} dir={sortDir} />;
  }


  const sorted     = [...orders].sort(compareOrders(sortKey, sortDir));
  const total      = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const pageRows   = sorted.slice((page - 1) * LIMIT, page * LIMIT);
  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  function doDelete() {
    const { id } = confirm;
    setConfirm({ show: false, id: null });
    apiServiceHandler('GET', `order/delete/${id}`)
      .then(() => { toast.error('Order deleted.'); fetchOrders(); })
      .catch(() => toast.warning('Delete failed.'));
  }

  const pageIds = pageRows.map(o => o._id);
  const allSelected = pageIds.length > 0 && pageIds.every(id => selected.includes(id));
  const toggleAll = () => setSelected(allSelected ? [] : pageIds);
  const toggleOne = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  function doBulkDelete() {
    setBulkConfirm(false);
    const ids = [...selected];
    setSelected([]);
    Promise.all(ids.map(id => apiServiceHandler('GET', `order/delete/${id}`)))
      .then(() => { toast.error(`${ids.length} order${ids.length !== 1 ? 's' : ''} deleted.`); fetchOrders(); })
      .catch(() => toast.warning('Some deletes failed.'));
  }

  const sortable = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };

  return (
    <SuperAdminShell activeSection="orders">
      <ConfirmModal
        show={confirm.show}
        title="Delete Order"
        message="Are you sure you want to delete this order?"
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null })}
      />
      <ConfirmModal
        show={bulkConfirm}
        title="Delete Selected Orders"
        message={`Delete ${selected.length} selected order${selected.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete All"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkConfirm(false)}
      />

      <div className={s.pageHeader} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div>
          <h1 className={s.pageTitle}>Orders</h1>
          <p className={s.pageSubtitle}>Credit purchase orders</p>
        </div>
        <button className={s.btnAdd} onClick={() => router.push('/superadmin/payments/orders/add')}>
          <PlusIcon />
          Add Order
        </button>
      </div>

      <div className={s.card}>
        <ListFilterBar
          label="Filter orders"
          orgs={orgs}
          statuses={STATUSES}
          filters={filters}
          onFilter={setFilter}
          onClear={resetFilters}
          canClear={hasFilters}
        />

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.checkTh}><input type="checkbox" aria-label="Select all orders on this page" checked={allSelected} onChange={toggleAll} /></th>
                <th>#</th>
                <th style={sortable} onClick={() => toggleSort('org_name')}>Organization{sortArrow('org_name')}</th>
                <th style={sortable} onClick={() => toggleSort('credit_title')}>Credit Package{sortArrow('credit_title')}</th>
                <th style={sortable} onClick={() => toggleSort('credit_amount')}>Amount{sortArrow('credit_amount')}</th>
                <th style={sortable} onClick={() => toggleSort('purchase_date')}>Purchase Date{sortArrow('purchase_date')}</th>
                <th style={sortable} onClick={() => toggleSort('payment_gateway')}>Gateway{sortArrow('payment_gateway')}</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={9} />
              ) : pageRows.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={9}><EmptyState>{hasFilters ? 'No orders match these filters.' : 'No orders found.'}</EmptyState></td></tr>
              ) : pageRows.map((o, idx) => (
                <tr key={o._id}>
                  <td className={s.checkTd}>
                    <input type="checkbox" aria-label={`Select order ${o.credit_id?.title || ''} for ${o.organizer_id?.org_name || ''}`}
                      checked={selected.includes(o._id)} onChange={() => toggleOne(o._id)} />
                  </td>
                  <td className={s.colMuted}>{(page - 1) * LIMIT + idx + 1}</td>
                  <td>{o.organizer_id?.org_name || '—'}</td>
                  <td>{o.credit_id?.title || '—'}</td>
                  <td className={s.colAmount}>{fmtAmount(o.credit_amount)}</td>
                  <td className={s.colMuted}>{fmtDate(o.purchase_date)}</td>
                  <td><span className={s.colGateway}>{o.payment_gateway || '—'}</span></td>
                  <td><StatusBadge status={o.status} /></td>
                  <td>
                    <div className={s.actions}>
                      <button data-action="view" className={s.btnView} title="View" aria-label="View order" onClick={() => router.push(`/superadmin/payments/orders/view/${o._id}`)}>
                        <EyeIcon />
                      </button>
                      <button data-action="delete" className={s.btnDelete} title="Delete" aria-label="Delete order" onClick={() => setConfirm({ show: true, id: o._id })}>
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
              <button type="button" data-bulk-action="delete" className={s.btnBulkDelete} onClick={() => setBulkConfirm(true)}>
                <TrashIcon />
                Delete Selected ({selected.length})
              </button>
            )}
            <span>
              <ResultCount from={from} to={to} total={total} singular="order" plural="orders" />
            </span>
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
