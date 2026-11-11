'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import apiServiceHandler from '../../../service/apiService';
import SuperAdminShell from '../SuperAdminShell';
import ConfirmModal from '../ConfirmModal';
import sPage from './TagsList.module.css';
import { withAdminKit } from '../AdminKit/AdminKit';
import { orDash } from '../../../lib/displayValue';

// Page styles + the shared super admin look.
const s = withAdminKit(sPage);

const LIMIT = 50;
const SEARCH_DELAY_MS = 350;
const SKELETON_ROWS = 6;
const COLUMN_COUNT = 6;
const DATE_KEYS = ['createdAt', 'updatedAt'];

// Status tabs above the table; the value is sent to the API as ?status=
const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const Icon = {
  search: (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
};

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function plural(count, word) {
  return `${count} ${word}${count !== 1 ? 's' : ''}`;
}

// Page buttons to show: first, last and the pages around the current one, with "…" for the gaps.
function pageItems(current, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const wanted = [1, current - 1, current, current + 1, totalPages]
    .filter(p => p >= 1 && p <= totalPages);
  const pages = [...new Set(wanted)].sort((a, b) => a - b);
  const items = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) items.push(`gap-${p}`);
    items.push(p);
  });
  return items;
}

function sortRows(rows, sortKey, sortDir) {
  if (!sortKey) return rows;
  const isDate = DATE_KEYS.includes(sortKey);
  const valueOf = row => (isDate
    ? new Date(row[sortKey] ?? '').getTime() || 0
    : String(row[sortKey] ?? '').toLowerCase());
  const direction = sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = valueOf(a);
    const bv = valueOf(b);
    if (av < bv) return -direction;
    if (av > bv) return direction;
    return 0;
  });
}

function SortHeader({ label, sortKey, activeKey, dir, onSort }) {
  const active = activeKey === sortKey;
  const ariaSort = !active ? 'none' : dir === 'asc' ? 'ascending' : 'descending';
  return (
    <th aria-sort={ariaSort}>
      <button type="button" className={`${s.sortBtn} ${active ? s.sortBtnActive : ''}`} onClick={() => onSort(sortKey)}>
        {label}
        <svg className={s.sortIcon} viewBox="0 0 10 14" aria-hidden="true">
          <path className={active && dir === 'asc' ? s.sortOn : ''} d="M5 1l4 4.5H1z" />
          <path className={active && dir === 'desc' ? s.sortOn : ''} d="M5 13l4-4.5H1z" />
        </svg>
      </button>
    </th>
  );
}

function SkeletonRows() {
  return Array.from({ length: SKELETON_ROWS }, (_, i) => (
    <tr key={i} className={s.skeletonRow} aria-hidden="true">
      <td className={s.checkTd}><span className={`${s.skeleton} ${s.skeletonBox}`} /></td>
      <td><span className={`${s.skeleton} ${s.skeletonMd}`} /></td>
      <td><span className={`${s.skeleton} ${s.skeletonLg}`} /></td>
      <td><span className={`${s.skeleton} ${s.skeletonPill}`} /></td>
      <td><span className={`${s.skeleton} ${s.skeletonSm}`} /></td>
      <td><span className={`${s.skeleton} ${s.skeletonMd}`} /></td>
    </tr>
  ));
}

export default function TagsList() {
  const router = useRouter();

  const [rows, setRows]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [debounced, setDebounced]   = useState('');
  const [status, setStatus]         = useState('');
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected]     = useState([]);
  const [confirm, setConfirm]       = useState({ show: false, id: null });
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().toLowerCase()), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [search]);

  const fetchRows = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (status) params.set('status', status);
    apiServiceHandler('GET', `tags/list-pagination?${params}`)
      .then(res => {
        setRows(Array.isArray(res?.data) ? res.data : []);
        setTotal(res?.total ?? 0);
        setTotalPages(res?.totalPages || 1);
      })
      .catch(() => {
        setRows([]);
        toast.warning('Could not load tags. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  function changeStatus(value) {
    setStatus(value);
    setPage(1);
    setSelected([]);
  }
  function changePage(next) {
    setPage(next);
    setSelected([]);
  }
  function clearSearch() {
    setSearch('');
    setDebounced('');
  }
  function clearFilters() {
    clearSearch();
    changeStatus('');
  }

  function handleDelete(id) { setConfirm({ show: true, id }); }
  function doDelete() {
    const id = confirm.id;
    setConfirm({ show: false, id: null });
    apiServiceHandler('GET', `tags/delete/${id}`)
      .then(() => {
        toast.error('Tag deleted.');
        setSelected(prev => prev.filter(x => x !== id));
        fetchRows();
      })
      .catch(() => toast.warning('Delete failed'));
  }

  function handleBulkDelete() { if (selected.length > 0) setBulkConfirm(true); }
  function doBulkDelete() {
    setBulkConfirm(false);
    const ids = [...selected];
    Promise.allSettled(ids.map(id => apiServiceHandler('GET', `tags/delete/${id}`)))
      .then(results => {
        const failedIds = ids.filter((_, i) => results[i].status === 'rejected');
        const done = ids.length - failedIds.length;
        if (done) toast.error(`${plural(done, 'tag')} deleted.`);
        if (failedIds.length) toast.warning(`${plural(failedIds.length, 'tag')} could not be deleted.`);
        setSelected(failedIds); // keep the ones that failed ticked, to try again
        fetchRows();
      });
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  // Search narrows the rows of the page that is loaded.
  const visible = debounced
    ? rows.filter(r =>
        (r.title ?? '').toLowerCase().includes(debounced) ||
        (r.desc ?? '').toLowerCase().includes(debounced))
    : rows;
  const sorted = sortRows(visible, sortKey, sortDir);

  const visibleIds = visible.map(r => r._id);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));
  const toggleAll = () => setSelected(allSelected ? [] : visibleIds);
  const toggleOne = id => setSelected(prev =>
    (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const hasFilters = Boolean(debounced || status);
  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to   = Math.min(page * LIMIT, total);

  return (
    <SuperAdminShell activeSection="tags">
      <ConfirmModal
        show={confirm.show}
        title="Delete Tag"
        message="Are you sure you want to delete this tag? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm({ show: false, id: null })}
      />
      <ConfirmModal
        show={bulkConfirm}
        title="Delete Selected Tags"
        message={`Delete ${plural(selected.length, 'selected tag')}? This cannot be undone.`}
        confirmLabel="Delete All"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkConfirm(false)}
      />

      <div className={s.pageHeader}>
        <div>
          <div className={s.titleRow}>
            <h1 className={s.pageTitle}>Tags</h1>
          </div>
          <p className={s.pageSubtitle}>Labels that group courses and help learners find them.</p>
        </div>
        <button type="button" className={s.btnAdd} onClick={() => router.push('/superadmin/tags/add')}>
          {Icon.plus}
          Add Tag
        </button>
      </div>

      <div className={s.card}>
        {/* Toolbar: search + status tabs */}
          <div className={s.toolbar}>
            <label className={s.searchField}>
              {Icon.search}
              <input
                className={s.searchBox}
                type="search"
                placeholder="Search tags by name or description"
                aria-label="Search tags"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" className={s.searchClear} aria-label="Clear search" onClick={clearSearch}>
                  {Icon.close}
                </button>
              )}
            </label>
            <span className={s.toolbarSpacer} />
            <div className={s.statusTabs} role="group" aria-label="Filter by status">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.label}
                  type="button"
                  aria-pressed={status === tab.value}
                  className={`${s.statusTab} ${status === tab.value ? s.statusTabActive : ''}`}
                  onClick={() => changeStatus(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.checkTh}>
                  <input type="checkbox" aria-label="Select all tags" checked={allSelected} onChange={toggleAll} />
                </th>
                <SortHeader label="Name" sortKey="title" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <th>Description</th>
                <th>Status</th>
                <SortHeader label="Created At" sortKey="createdAt" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : sorted.length === 0 ? (
                <tr className={s.emptyRow}>
                  <td colSpan={COLUMN_COUNT}>
                    <div className={s.emptyState}>
                      <span className={s.emptyIcon}>{Icon.tag}</span>
                      <p className={s.emptyTitle}>{hasFilters ? 'No tags match your filters' : 'No tags yet'}</p>
                      <p className={s.emptyText}>
                        {hasFilters
                          ? 'Try a different search, or clear the filters to see every tag.'
                          : 'Create your first tag to start grouping courses.'}
                      </p>
                      {hasFilters ? (
                        <button type="button" className={s.btnGhost} onClick={clearFilters}>Clear filters</button>
                      ) : (
                        <button type="button" className={s.btnAdd} onClick={() => router.push('/superadmin/tags/add')}>
                          {Icon.plus}
                          Add Tag
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : sorted.map(row => {
                const isSelected = selected.includes(row._id);
                return (
                  <tr key={row._id} className={isSelected ? s.rowSelected : ''} onClick={() => toggleOne(row._id)}>
                    <td className={s.checkTd} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.title ?? 'tag'}`}
                        checked={isSelected}
                        onChange={() => toggleOne(row._id)}
                      />
                    </td>
                    <td>
                      <div className={s.nameCell}>
                        <span className={s.tagIcon}>{Icon.tag}</span>
                        <span className={s.tagName}>{orDash(row.title)}</span>
                      </div>
                    </td>
                    <td>
                      <span className={s.descText} title={row.desc || undefined}>{orDash(row.desc)}</span>
                    </td>
                    <td>
                      {row.status === 'active'
                        ? <span className={s.badgeActive}>Active</span>
                        : <span className={s.badgeInactive}>{row.status ?? 'Inactive'}</span>}
                    </td>
                    <td className={s.dateCell}>{fmtDate(row.createdAt)}</td>
                    <td>
                      <div className={s.actions} onClick={e => e.stopPropagation()}>
                        <button type="button" data-action="view" className={s.btnView} title="View" aria-label="View tag"
                          onClick={() => router.push(`/superadmin/tags/${row._id}`)}>
                          {Icon.eye}
                        </button>
                        <button type="button" data-action="edit" className={s.btnEdit} title="Edit" aria-label="Edit tag"
                          onClick={() => router.push(`/superadmin/tags/${row._id}/edit`)}>
                          {Icon.edit}
                        </button>
                        <button type="button" data-action="delete" className={s.btnDelete} title="Delete" aria-label="Delete tag"
                          onClick={() => handleDelete(row._id)}>
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

        <div className={s.tableFooter}>
          <div className={s.footerLeft}>
            {selected.length > 0 && (
              <button type="button" data-bulk-action="delete" className={s.btnBulkDelete} onClick={handleBulkDelete}>
                {Icon.trash}
                Delete Selected ({selected.length})
              </button>
            )}
          <span className={s.footerInfo}>
            {total === 0
              ? 'No tags'
              : <>Showing <strong>{from}</strong> to <strong>{to}</strong> of <strong>{total}</strong> {total !== 1 ? 'tags' : 'tag'}</>}
          </span>
          </div>
          <nav className={s.pagination} aria-label="Pagination">
            <button type="button" className={s.pageBtn} disabled={page <= 1} onClick={() => changePage(page - 1)}>
              Previous
            </button>
            {pageItems(page, totalPages).map(item => (
              typeof item === 'number' ? (
                <button
                  key={item}
                  type="button"
                  aria-current={item === page ? 'page' : undefined}
                  className={`${s.pageBtn} ${item === page ? s.pageBtnActive : ''}`}
                  onClick={() => changePage(item)}
                >
                  {item}
                </button>
              ) : (
                <span key={item} className={s.pageGap} aria-hidden="true">…</span>
              )
            ))}
            <button type="button" className={s.pageBtn} disabled={page >= totalPages} onClick={() => changePage(page + 1)}>
              Next
            </button>
          </nav>
        </div>
      </div>
    </SuperAdminShell>
  );
}
