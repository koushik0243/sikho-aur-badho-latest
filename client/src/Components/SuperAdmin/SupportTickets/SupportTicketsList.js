'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from "./SupportTicketsList.module.css";
import fb from '../ListFilterBar.module.css';
import { ISSUE_TYPES, PRIORITIES } from '../../../lib/supportTickets';
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, ResultCount, SkeletonRows, SortArrow, pageItems } from '../AdminKit/ListParts';
import { orDash } from '../../../lib/displayValue';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

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

const STATUS_MAP = {
  open:         { label: 'Open',         cls: 'badgeOpen' },
  in_progress:  { label: 'In Progress',  cls: 'badgeInProgress' },
  resolved:     { label: 'Resolved',     cls: 'badgeResolved' },
  close:        { label: 'Closed',       cls: 'badgeClosed' },
  not_possible: { label: 'Not Possible', cls: 'badgeNotPossible' },
  deleted:      { label: 'Deleted',      cls: 'badgeDeleted' },
};

const PRIORITY_CLS = { Low: 'priLow', Normal: 'priNormal', High: 'priHigh', Urgent: 'priUrgent' };

const LIMIT = 50;

const EMPTY_FILTERS = Object.freeze({ orgId: '', issueType: '', priority: '', dateFrom: '', dateTo: '', status: '' });

/** "2026-10-13" → that day's first / last millisecond in local time. */
function dayTime(ymd, end) {
  const [y, m, d] = ymd.split('-').map(Number);
  return (end ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d)).getTime();
}

export default function SupportTicketsList() {
  const router = useRouter();
  const [tickets, setTickets]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [orgs, setOrgs]             = useState([]);
  const [filters, setFilters]       = useState(EMPTY_FILTERS);
  const [page, setPage]             = useState(1);
  const [confirm, setConfirm]       = useState({ show: false, id: null });
  const [selected, setSelected]     = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [sortKey, setSortKey]       = useState('createdAt');
  const [sortDir, setSortDir]       = useState('desc');

  // Timestamp skips apiServiceHandler's GET cache, so a reload after a delete is fresh.
  const fetchTickets = useCallback(() => {
    apiServiceHandler('GET', `support-ticket/list?t=${Date.now()}`)
      .then(res => setTickets(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

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
  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setSelected([]);
  }
  const hasFilters = Object.values(filters).some(Boolean);
  const dateRangeInvalid = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);

  function toggleSort(key) {
    setPage(1);
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function sortArrow(key) {
    return <SortArrow active={sortKey === key} dir={sortDir} />;
  }

  // Raised On range (both days inclusive); an inverted range shows nothing until fixed.
  const fromTime = filters.dateFrom ? dayTime(filters.dateFrom, false) : null;
  const toTime   = filters.dateTo ? dayTime(filters.dateTo, true) : null;
  const filtered = dateRangeInvalid ? [] : tickets.filter(t => {
    if (filters.orgId && String(t.orgId?._id ?? t.orgId ?? '') !== filters.orgId) return false;
    if (filters.issueType && t.issue_type !== filters.issueType) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.status && t.status !== filters.status) return false;
    if (fromTime !== null || toTime !== null) {
      const raised = new Date(t.createdAt).getTime();
      if (!raised) return false;
      if (fromTime !== null && raised < fromTime) return false;
      if (toTime !== null && raised > toTime) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const isDate = ['createdAt', 'updatedAt'].includes(sortKey);
    let av = a[sortKey] ?? ''; let bv = b[sortKey] ?? '';
    if (isDate) { av = new Date(av).getTime() || 0; bv = new Date(bv).getTime() || 0; }
    else { av = String(av).toLowerCase(); bv = String(bv).toLowerCase(); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages  = Math.max(1, Math.ceil(sorted.length / LIMIT));
  const paged       = sorted.slice((page - 1) * LIMIT, page * LIMIT);
  const from        = sorted.length === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to          = Math.min(page * LIMIT, sorted.length);

  function doDelete() {
    const id = confirm.id;
    setConfirm({ show: false, id: null });
    apiServiceHandler('GET', `support-ticket/delete/${id}`)
      .then(() => { toast.error('Ticket deleted.'); fetchTickets(); })
      .catch(() => toast.warning('Delete failed.'));
  }

  const allIds = paged.map(t => t._id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.includes(id));
  const toggleAll = () => setSelected(allSelected ? [] : [...new Set([...selected, ...allIds])]);
  const toggleOne = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  function doBulkDelete() {
    setBulkConfirm(false);
    const ids = [...selected];
    setSelected([]);
    Promise.all(ids.map(id => apiServiceHandler('GET', `support-ticket/delete/${id}`)))
      .then(() => { toast.error(`${ids.length} ticket${ids.length !== 1 ? 's' : ''} deleted.`); fetchTickets(); })
      .catch(() => toast.warning('Some deletes failed.'));
  }

  return (
    <SuperAdminShell activeSection="support-tickets">
      <ConfirmModal
        show={confirm.show}
        title="Delete Ticket"
        message="Are you sure you want to delete this ticket?"
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null })}
      />
      <ConfirmModal
        show={bulkConfirm}
        title="Delete Selected Tickets"
        message={`Delete ${selected.length} selected ticket${selected.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete All"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkConfirm(false)}
      />

      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Support Tickets</h1>
          <p className={s.pageSubtitle}>All tickets raised by organizers</p>
        </div>
      </div>

      <div className={s.card}>
        <div className={fb.filterBar} style={{ '--filter-cols': 6 }} role="search" aria-label="Filter support tickets">
          <label className={fb.filterField}>
            <span className={fb.filterLabel}>Organization</span>
            <select className={fb.filterControl} value={filters.orgId} onChange={e => setFilter('orgId', e.target.value)}>
              <option value="">All Organizations</option>
              {orgs.map(o => <option key={o._id} value={o._id}>{o.org_name}</option>)}
            </select>
          </label>
          <label className={fb.filterField}>
            <span className={fb.filterLabel}>Issue Type</span>
            <select className={fb.filterControl} value={filters.issueType} onChange={e => setFilter('issueType', e.target.value)}>
              <option value="">All Issue Types</option>
              {ISSUE_TYPES.map(it => <option key={it} value={it}>{it}</option>)}
            </select>
          </label>
          <label className={fb.filterField}>
            <span className={fb.filterLabel}>Priority</span>
            <select className={fb.filterControl} value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
              <option value="">All Priorities</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className={fb.filterField}>
            <span className={fb.filterLabel}>Date From</span>
            <input type="date" className={fb.filterControl} value={filters.dateFrom} max={filters.dateTo || undefined}
              onChange={e => setFilter('dateFrom', e.target.value)} />
          </label>
          <label className={fb.filterField}>
            <span className={fb.filterLabel}>Date To</span>
            <input type="date" className={fb.filterControl} value={filters.dateTo} min={filters.dateFrom || undefined}
              onChange={e => setFilter('dateTo', e.target.value)} />
          </label>
          <label className={fb.filterField}>
            <span className={fb.filterLabel}>Status</span>
            <select className={fb.filterControl} value={filters.status} onChange={e => setFilter('status', e.target.value)}>
              <option value="">All Statuses</option>
              {Object.entries(STATUS_MAP).filter(([k]) => k !== 'deleted').map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className={fb.btnClear} onClick={clearFilters} disabled={!hasFilters}>Clear</button>
        </div>
        {dateRangeInvalid && <p className={fb.filterError} role="alert">Date From must be on or before Date To.</p>}

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.checkTh}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th>#</th>
                <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => toggleSort('ticket_id')}>
                  Ticket ID{sortArrow('ticket_id')}
                </th>
                <th>Organization</th>
                <th>Issue Type</th>
                <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => toggleSort('subject')}>
                  Subject{sortArrow('subject')}
                </th>
                <th>Priority</th>
                <th>Status</th>
                <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => toggleSort('createdAt')}>
                  Raised On{sortArrow('createdAt')}
                </th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={10} />
              ) : paged.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={10}><EmptyState>{hasFilters ? 'No tickets match these filters.' : 'No tickets found.'}</EmptyState></td></tr>
              ) : paged.map((t, idx) => {
                const sc  = STATUS_MAP[t.status] ?? STATUS_MAP.open;
                const pc  = PRIORITY_CLS[t.priority] ?? 'priNormal';
                return (
                  <tr key={t._id} style={{ cursor: 'pointer' }} onClick={() => toggleOne(t._id)}>
                    <td className={s.checkTd} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(t._id)} onChange={() => toggleOne(t._id)} />
                    </td>
                    <td>{(page - 1) * LIMIT + idx + 1}</td>
                    <td style={{ fontWeight: 600, color: '#374151' }}>#{t.ticket_id}</td>
                    <td>{t.orgId?.org_name || '—'}</td>
                    <td>{t.issue_type}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.subject}
                    </td>
                    <td><span className={s[pc]}>{orDash(t.priority)}</span></td>
                    <td><span className={`${s.badge} ${s[sc.cls]}`}>{sc.label}</span></td>
                    <td>{fmtDate(t.createdAt)}</td>
                    <td>
                      <div className={s.actions} onClick={e => e.stopPropagation()}>
                        <button data-action="view"
                          className={s.btnView}
                          title="View"
                          onClick={() => router.push(`/superadmin/support-tickets/${t._id}`)}
                        >
                          <EyeIcon />
                        </button>
                        <button data-action="edit"
                          className={s.btnEdit}
                          title="Edit"
                          onClick={() => router.push(`/superadmin/support-tickets/${t._id}/edit`)}
                        >
                          <EditIcon />
                        </button>
                        <button data-action="delete"
                          className={s.btnDelete}
                          title="Delete"
                          onClick={() => setConfirm({ show: true, id: t._id })}
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
          <div className={s.footerLeft}>
            {selected.length > 0 && (
              <button type="button" data-bulk-action="delete" className={s.btnBulkDelete} onClick={() => setBulkConfirm(true)}>
                <TrashIcon />
                Delete Selected ({selected.length})
              </button>
            )}
            <span><ResultCount from={from} to={to} total={sorted.length} singular="ticket" plural="tickets" /></span>
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
