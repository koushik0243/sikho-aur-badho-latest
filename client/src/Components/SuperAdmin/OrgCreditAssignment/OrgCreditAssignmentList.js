'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import ListFilterBar, { EMPTY_LIST_FILTERS, isDateRangeInvalid, listFilterParams } from '../ListFilterBar';
import sPage from "./OrgCreditAssignmentList.module.css";
import { withAdminKit } from '../AdminKit/AdminKit';
import { EmptyState, PageGap, PlusIcon, ResultCount, SkeletonRows, SortArrow, pageItems } from '../AdminKit/ListParts';
import useBulkDelete from '../AdminKit/useBulkDelete';
import { orDash } from '../../../lib/displayValue';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

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
  const num = parseFloat(val?.$numberDecimal ?? val);
  if (isNaN(num)) return '—';
  return `₹${num.toFixed(2)}`;
}

const LIMIT = 50;

const STATUSES = [
  { value: 'active',   label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const time = v => new Date(v).getTime() || 0;

/** Row order on the page: by the clicked column; otherwise the server's order (most recent first). */
function compareRecords(key, dir) {
  const sign = dir === 'asc' ? 1 : -1;
  const pick = {
    orgName:    r => (r.orgId?.org_name ?? '').toLowerCase(),
    assignedOn: r => time(r.createdAt),
  }[key];
  if (!pick) return null;
  return (a, b) => { const av = pick(a), bv = pick(b); return av < bv ? -sign : av > bv ? sign : 0; };
}

export default function OrgCreditAssignmentList() {
  const router = useRouter();
  const [loaded, setLoaded]       = useState({ key: null, records: [], total: 0, totalPages: 1 });
  const [reloadToken, setReloadToken] = useState(0);
  const [orgs, setOrgs]           = useState([]);
  const [filters, setFilters]     = useState(EMPTY_LIST_FILTERS);
  const [page, setPage]           = useState(1);
  const [confirm, setConfirm]     = useState({ show: false, id: null, label: '' });
  const [sortKey, setSortKey]     = useState('');
  const [sortDir, setSortDir]     = useState('asc');

  const dateRangeInvalid = isDateRangeInvalid(filters);

  // One page of assignments matching the filters (filtered + paged on the server, newest first).
  const query = `${listFilterParams(filters, { orgParam: 'orgId', statusParam: 'status' })}`;
  const queryKey = `${query}|${page}|${reloadToken}`;
  const loading = !dateRangeInvalid && loaded.key !== queryKey;
  const { records, total, totalPages } = loaded;

  useEffect(() => {
    if (dateRangeInvalid) return undefined;
    let cancelled = false;
    const params = new URLSearchParams(query);
    params.set('page', String(page));
    params.set('limit', String(LIMIT));
    params.set('t', String(Date.now()));   // skip apiServiceHandler's GET cache (fresh after a delete)
    apiServiceHandler('GET', `organization-credit-assignment/list-pagination?${params}`)
      .then(res => {
        if (cancelled) return;
        setLoaded({
          key: queryKey,
          records: Array.isArray(res?.data) ? res.data : [],
          total: res?.total ?? 0,
          totalPages: Math.max(1, res?.totalPages ?? 1),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded({ key: queryKey, records: [], total: 0, totalPages: 1 });
        toast.warning('Failed to load credit assignments.');
      });
    return () => { cancelled = true; };
  }, [query, page, queryKey, dateRangeInvalid]);

  useEffect(() => {
    apiServiceHandler('GET', 'organization/list-pagination?limit=1000')
      .then(res => setOrgs(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setOrgs([]));
  }, []);

  function setFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }
  function clearFilters() {
    setFilters(EMPTY_LIST_FILTERS);
    setPage(1);
  }
  const hasFilters = Object.values(filters).some(Boolean);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function sortArrow(key) {
    return <SortArrow active={sortKey === key} dir={sortDir} />;
  }

  const cmp = compareRecords(sortKey, sortDir);
  const rows = dateRangeInvalid ? [] : (cmp ? [...records].sort(cmp) : records);

  function doDelete() {
    const { id } = confirm;
    setConfirm({ show: false, id: null, label: '' });
    apiServiceHandler('GET', `organization-credit-assignment/delete/${id}`)
      .then(() => { toast.error('Assignment deleted.'); setReloadToken(n => n + 1); })
      .catch(() => toast.warning('Delete failed.'));
  }

  const shownTotal = dateRangeInvalid ? 0 : total;
  const from = shownTotal === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, shownTotal);

  // Ticked rows on this page → "Delete Selected (N)".
  const bulk = useBulkDelete({
    visibleIds: rows.map(r => String(r._id)),
    deletePath: id => `organization-credit-assignment/delete/${id}`,
    singular: 'credit assignment',
    plural: 'credit assignments',
    onDeleted: () => setReloadToken(n => n + 1),
  });

  return (
    <SuperAdminShell activeSection="assign-credit">
      <ConfirmModal
        show={confirm.show}
        title="Delete Assignment"
        message={`Delete the assignment "${confirm.label}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null, label: '' })}
      />
      <ConfirmModal {...bulk.confirmProps} />

      <div className={s.pageHeader} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
        <div>
          <h1 className={s.pageTitle}>Credit Assignments</h1>
          <p className={s.pageSubtitle}>Manage credit plan assignments to organizations</p>
        </div>
        <button className={s.btnAdd} onClick={() => router.push('/superadmin/organization-credit-assignment/add')}>
          <PlusIcon />
          Add Assignment
        </button>
      </div>

      <div className={s.card}>
        <ListFilterBar
          label="Filter credit assignments"
          orgs={orgs}
          statuses={STATUSES}
          filters={filters}
          onFilter={setFilter}
          onClear={clearFilters}
          canClear={hasFilters}
        />

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.checkTh}>
                  <input type="checkbox" aria-label="Select all credit assignments on this page" checked={bulk.allSelected} onChange={bulk.toggleAll} />
                </th>
                <th>#</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('orgName')}>Organization{sortArrow('orgName')}</th>
                <th>Assigned Credits</th>
                <th>Status</th>
                <th style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}} onClick={() => toggleSort('assignedOn')}>Assigned On{sortArrow('assignedOn')}</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={7} />
              ) : rows.length === 0 ? (
                <tr className={s.emptyRow}><td colSpan={7}><EmptyState>{hasFilters ? 'No credit assignments match these filters.' : 'No credit assignments found.'}</EmptyState></td></tr>
              ) : rows.map((rec, idx) => {
                const org = rec.orgId;
                const credit = rec.creditId;
                const orgName = org?.org_name || '—';
                return (
                  <tr key={rec._id}>
                    <td className={s.checkTd}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${credit?.title || 'credit'} assignment for ${orgName}`}
                        checked={bulk.isSelected(rec._id)}
                        onChange={() => bulk.toggle(rec._id)}
                      />
                    </td>
                    <td>{(page - 1) * LIMIT + idx + 1}</td>
                    <td>
                      <div className={s.cellMain}>{orgName}</div>
                      {org?.org_phone && <div className={s.cellSub}>{org.org_phone}</div>}
                      {org?.org_email && <div className={s.cellSub}>{org.org_email}</div>}
                    </td>
                    <td>
                      {credit ? (
                        <div className={s.cellMain}>
                          {credit.title || '—'} <span className={s.cellSub}>({orDash(credit.limit_from)}-{orDash(credit.limit_to)}) {fmtPrice(credit.price)}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td>
                      {rec.status === 'active'
                        ? <span className={s.badgeActive}>Active</span>
                        : <span className={s.badgeInactive}>Inactive</span>}
                    </td>
                    <td>{fmtDate(rec.createdAt)}</td>
                    <td>
                      <div className={s.actions}>
                        <button data-action="delete"
                          className={s.btnDelete}
                          title="Delete"
                          aria-label={`Delete ${credit?.title || 'credit'} assignment for ${orgName}`}
                          onClick={() => setConfirm({ show: true, id: rec._id, label: `${orgName} — ${credit?.title || '—'}` })}
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
            {bulk.selected.length > 0 && (
              <button type="button" data-bulk-action="delete" className={s.btnBulkDelete} onClick={bulk.askToDelete} disabled={bulk.deleting}>
                <TrashIcon />
                Delete Selected ({bulk.selected.length})
              </button>
            )}
            <span><ResultCount from={from} to={to} total={shownTotal} singular="credit assignment" plural="credit assignments" /></span>
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
