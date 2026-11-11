'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from "./InvoicesList.module.css";
import ListFilterBar, { EMPTY_LIST_FILTERS, isDateRangeInvalid, listFilterParams } from '../ListFilterBar';
import { usePaymentMethods } from '../../../lib/paymentMethods';
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

function fmtAmount(val, currency = 'INR') {
  if (val === null || val === undefined) return '—';
  const symbol = currency === 'INR' ? '₹' : currency + ' ';
  return `${symbol}${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const LIMIT = 50;

// Invoice payment statuses (the "Status" filter).
const PAYMENT_STATUSES = [
  { value: 'paid',     label: 'Paid' },
  { value: 'pending',  label: 'Pending' },
  { value: 'failed',   label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

const time = v => new Date(v).getTime() || 0;

/** List order: by the clicked column, otherwise most recent payment first. */
function compareInvoices(key, dir) {
  const sign = dir === 'asc' ? 1 : -1;
  const pick = {
    invoice_no:     inv => (inv.invoice_no ?? '').toLowerCase(),
    org_name:       inv => (inv.org_id?.org_name ?? '').toLowerCase(),
    credit_title:   inv => (inv.order_id?.credit_id?.title ?? '').toLowerCase(),
    total_amount:   inv => Number(inv.total_amount) || 0,
    payment_status: inv => String(inv.payment_status || '').toLowerCase(),
    payment_method: inv => String(inv.payment_method || '').toLowerCase(),
    payment_date:   inv => time(inv.payment_date),
    status:         inv => String(inv.status || '').toLowerCase(),
  }[key];
  if (!pick) return (a, b) => (time(b.payment_date || b.createdAt) - time(a.payment_date || a.createdAt)) || (time(b.createdAt) - time(a.createdAt));
  return (a, b) => { const av = pick(a), bv = pick(b); return av < bv ? -sign : av > bv ? sign : 0; };
}

export default function InvoicesList() {
  const { labelOf: paymentMethodLabel } = usePaymentMethods();
  const router = useRouter();
  const [loaded, setLoaded]         = useState({ key: null, invoices: [] });   // invoices for one query
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

  // Every invoice matching the filters (filtered on the server); sorted and paged here.
  const queryKey = `${listFilterParams(filters, { orgParam: 'org_id', statusParam: 'payment_status' })}#${reloadToken}`;
  const loading = !dateRangeInvalid && loaded.key !== queryKey;
  const invoices = loaded.invoices;

  useEffect(() => {
    if (dateRangeInvalid) return undefined;
    let cancelled = false;
    const [query] = queryKey.split('#');
    apiServiceHandler('GET', `invoice/list?${query}${query ? '&' : ''}t=${Date.now()}`)
      .then(res => { if (!cancelled) setLoaded({ key: queryKey, invoices: Array.isArray(res?.data) ? res.data : [] }); })
      .catch(() => {
        if (cancelled) return;
        setLoaded({ key: queryKey, invoices: [] });
        toast.warning('Failed to load invoices.');
      });
    return () => { cancelled = true; };
  }, [queryKey, dateRangeInvalid]);

  const fetchInvoices = () => setReloadToken(n => n + 1);

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


  const sorted     = [...invoices].sort(compareInvoices(sortKey, sortDir));
  const total      = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const pageRows   = sorted.slice((page - 1) * LIMIT, page * LIMIT);
  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  function doDelete() {
    const { id } = confirm;
    setConfirm({ show: false, id: null });
    apiServiceHandler('GET', `invoice/delete/${id}`)
      .then(() => { toast.error('Invoice deleted.'); fetchInvoices(); })
      .catch(() => toast.warning('Delete failed.'));
  }

  const pageIds = pageRows.map(inv => inv._id);
  const allSelected = pageIds.length > 0 && pageIds.every(id => selected.includes(id));
  const toggleAll = () => setSelected(allSelected ? [] : pageIds);
  const toggleOne = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  function doBulkDelete() {
    setBulkConfirm(false);
    const ids = [...selected];
    setSelected([]);
    Promise.all(ids.map(id => apiServiceHandler('GET', `invoice/delete/${id}`)))
      .then(() => { toast.error(`${ids.length} invoice${ids.length !== 1 ? 's' : ''} deleted.`); fetchInvoices(); })
      .catch(() => toast.warning('Some deletes failed.'));
  }

  const sortable = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };

  return (
    <SuperAdminShell activeSection="invoices">
      <ConfirmModal
        show={confirm.show}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice?"
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null })}
      />
      <ConfirmModal
        show={bulkConfirm}
        title="Delete Selected Invoices"
        message={`Delete ${selected.length} selected invoice${selected.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete All"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkConfirm(false)}
      />

      <div className={s.pageHeader} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div>
          <h1 className={s.pageTitle}>Invoices</h1>
          <p className={s.pageSubtitle}>Credit purchase invoices</p>
        </div>
        <button className={s.btnAdd} onClick={() => router.push('/superadmin/payments/invoices/add')}>
          <PlusIcon />
          Add Invoice
        </button>
      </div>

      <div className={s.card}>
        <ListFilterBar
          label="Filter invoices"
          orgs={orgs}
          statuses={PAYMENT_STATUSES}
          filters={filters}
          onFilter={setFilter}
          onClear={resetFilters}
          canClear={hasFilters}
        />

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.checkTh}><input type="checkbox" aria-label="Select all invoices on this page" checked={allSelected} onChange={toggleAll} /></th>
                <th>#</th>
                <th style={sortable} onClick={() => toggleSort('invoice_no')}>Invoice No{sortArrow('invoice_no')}</th>
                <th style={sortable} onClick={() => toggleSort('org_name')}>Organization{sortArrow('org_name')}</th>
                <th style={sortable} onClick={() => toggleSort('credit_title')}>Credit Package{sortArrow('credit_title')}</th>
                <th style={sortable} onClick={() => toggleSort('total_amount')}>Total{sortArrow('total_amount')}</th>
                <th style={sortable} onClick={() => toggleSort('payment_status')}>Payment{sortArrow('payment_status')}</th>
                <th style={sortable} onClick={() => toggleSort('payment_method')}>Method{sortArrow('payment_method')}</th>
                <th style={sortable} onClick={() => toggleSort('payment_date')}>Payment Date{sortArrow('payment_date')}</th>
                <th style={sortable} onClick={() => toggleSort('status')}>Status{sortArrow('status')}</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={11} />
              ) : pageRows.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={11}><EmptyState>{hasFilters ? 'No invoices match these filters.' : 'No invoices found.'}</EmptyState></td></tr>
              ) : pageRows.map((inv, idx) => (
                <tr key={inv._id}>
                  <td className={s.checkTd}>
                    <input type="checkbox" aria-label={`Select invoice ${inv.invoice_no || ''}`}
                      checked={selected.includes(inv._id)} onChange={() => toggleOne(inv._id)} />
                  </td>
                  <td>{(page - 1) * LIMIT + idx + 1}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{inv.invoice_no || '—'}</td>
                  <td>{inv.org_id?.org_name || '—'}</td>
                  <td>{inv.order_id?.credit_id?.title || '—'}</td>
                  <td>{fmtAmount(inv.total_amount, inv.currency)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{inv.payment_status || '—'}</td>
                  <td>{paymentMethodLabel(inv.payment_method)}</td>
                  <td>{fmtDate(inv.payment_date)}</td>
                  <td>
                    {inv.status === 'active'
                      ? <span className={s.badgeActive}>Active</span>
                      : <span className={s.badgeInactive}>Inactive</span>}
                  </td>
                  <td>
                    <div className={s.actions}>
                      <button data-action="view" className={s.btnView} title="View" aria-label="View invoice" onClick={() => router.push(`/superadmin/payments/invoices/view/${inv._id}`)}>
                        <EyeIcon />
                      </button>
                      <button data-action="delete" className={s.btnDelete} title="Delete" aria-label="Delete invoice" onClick={() => setConfirm({ show: true, id: inv._id })}>
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
              <ResultCount from={from} to={to} total={total} singular="invoice" plural="invoices" />
            </span>
          </div>
          <div className={s.paginationBtns}>
            <button className={s.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            {pageItems(page, totalPages).map(p => typeof p !== 'number' ? <PageGap key={p} /> : (
              <button key={p} className={`${s.pageBtn} ${p === page ? s.pageBtnActive : ''}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className={s.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      </div>
    </SuperAdminShell>
  );
}
