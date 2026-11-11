'use client';

import s from './ListFilterBar.module.css';

// SuperAdmin list pages (Orders, Invoices, Credit Assignments): Organization /
// date range / Status filter bar, plus its query-string helpers.

export const EMPTY_LIST_FILTERS = Object.freeze({ orgId: '', status: '', dateFrom: '', dateTo: '' });

/** "2026-10-13" → that day's first / last moment in local time, as ISO. */
export function dayBoundary(ymd, end) {
  const [y, m, d] = ymd.split('-').map(Number);
  return (end ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d)).toISOString();
}

export const isDateRangeInvalid = f => Boolean(f.dateFrom && f.dateTo && f.dateFrom > f.dateTo);

/**
 * Filters → list query string (the org / status params are named per endpoint).
 * @param {{ orgParam: string, statusParam: string }} names
 */
export function listFilterParams(filters, { orgParam, statusParam }) {
  const params = new URLSearchParams();
  if (filters.orgId)    params.set(orgParam, filters.orgId);
  if (filters.status)   params.set(statusParam, filters.status);
  if (filters.dateFrom) params.set('date_from', dayBoundary(filters.dateFrom, false));
  if (filters.dateTo)   params.set('date_to', dayBoundary(filters.dateTo, true));
  return params.toString();
}

/**
 * Organization / Date From / Date To / Status + Clear.
 * @param {{
 *   orgs: Array<{ _id: string, org_name: string }>,
 *   statuses: Array<{ value: string, label: string }>,
 *   statusLabel?: string,
 *   filters: typeof EMPTY_LIST_FILTERS,
 *   onFilter: (key: string, value: string) => void,
 *   onClear: () => void, canClear: boolean,
 *   label: string,                       // aria-label, e.g. "Filter orders"
 * }} props
 */
export default function ListFilterBar({ orgs, statuses, statusLabel = 'Status', filters, onFilter, onClear, canClear, label }) {
  return (
    <>
      <div className={s.filterBar} role="search" aria-label={label}>
        <label className={s.filterField}>
          <span className={s.filterLabel}>Organization</span>
          <select className={s.filterControl} value={filters.orgId} onChange={e => onFilter('orgId', e.target.value)}>
            <option value="">All Organizations</option>
            {orgs.map(o => <option key={o._id} value={o._id}>{o.org_name}</option>)}
          </select>
        </label>
        <label className={s.filterField}>
          <span className={s.filterLabel}>Date From</span>
          <input type="date" className={s.filterControl} value={filters.dateFrom} max={filters.dateTo || undefined}
            onChange={e => onFilter('dateFrom', e.target.value)} />
        </label>
        <label className={s.filterField}>
          <span className={s.filterLabel}>Date To</span>
          <input type="date" className={s.filterControl} value={filters.dateTo} min={filters.dateFrom || undefined}
            onChange={e => onFilter('dateTo', e.target.value)} />
        </label>
        <label className={s.filterField}>
          <span className={s.filterLabel}>{statusLabel}</span>
          <select className={s.filterControl} value={filters.status} onChange={e => onFilter('status', e.target.value)}>
            <option value="">All Statuses</option>
            {statuses.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
          </select>
        </label>
        <button type="button" className={s.btnClear} onClick={onClear} disabled={!canClear}>Clear</button>
      </div>
      {isDateRangeInvalid(filters) && <p className={s.filterError} role="alert">Date From must be on or before Date To.</p>}
    </>
  );
}
