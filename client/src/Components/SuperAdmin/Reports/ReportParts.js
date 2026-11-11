'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import apiServiceHandler from '../../../service/apiService';
import { PERIODS, periodRange, todayYMD } from './reportFormat';
import s from './Report.module.css';

export const DownloadIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

/** Width of an element, kept up to date (for charts). A callback ref, so it
 *  works when the element appears later (after loading, or when a table view closes). */
export function useWidth() {
  const [width, setWidth] = useState(0);
  const observer = useRef(null);
  const ref = useCallback(node => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(node);
    observer.current = ro;
  }, []);
  return [ref, width];
}

/** Like useWidth, but tracks the element's height too: [ref, width, height]. */
export function useSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observer = useRef(null);
  const ref = useCallback(node => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => setSize({
      width: Math.floor(entry.contentRect.width),
      height: Math.floor(entry.contentRect.height),
    }));
    ro.observe(node);
    observer.current = ro;
  }, []);
  return [ref, size.width, size.height];
}

/** Share of the total: a thin bar plus the percentage. */
export function ShareCell({ share }) {
  return (
    <>
      <span className={s.shareBar} aria-hidden="true"><span style={{ width: `${Math.min(100, share)}%` }} /></span>
      <span className={s.shareText}>{share}%</span>
    </>
  );
}

/** One bar split into parts, with a legend (labels + counts, never colour alone). */
export function SplitBar({ parts, label }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  return (
    <div className={s.splitBlock}>
      <div className={s.splitBar} role="img" aria-label={`${label}: ${parts.map(p => `${p.label} ${p.value}`).join(', ')}`}>
        {total === 0 ? <span className={s.splitEmpty} /> : parts.filter(p => p.value > 0).map(p => (
          <span key={p.label} className={p.className} style={{ flexGrow: p.value }} title={`${p.label}: ${p.value}`} />
        ))}
      </div>
      <ul className={s.splitLegend}>
        {parts.map(p => (
          <li key={p.label}><span className={`${s.legendDot} ${p.className}`} aria-hidden="true" />{p.label} <strong>{p.value}</strong>
            {total > 0 && <span className={s.legendPct}> ({Math.round((p.value / total) * 100)}%)</span>}</li>
        ))}
      </ul>
    </div>
  );
}

const BADGE_ICON = {
  critical: 'M10 2a1 1 0 01.87.5l7 12A1 1 0 0117 16H3a1 1 0 01-.87-1.5l7-12A1 1 0 0110 2zm0 5a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1zm0 7.5a1 1 0 100-2 1 1 0 000 2z',
  warning: 'M10 18a8 8 0 100-16 8 8 0 000 16zm0-12a1 1 0 011 1v3a1 1 0 11-2 0V7a1 1 0 011-1zm0 8.5a1 1 0 100-2 1 1 0 000 2z',
  info: 'M10 18a8 8 0 100-16 8 8 0 000 16zm0-11.5a1 1 0 100-2 1 1 0 000 2zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9z',
  ok: 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.58 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z',
};

/** A status pill: icon + label, never colour alone. tone: critical | warning | info | ok */
export function Badge({ tone, label }) {
  return (
    <span className={`${s.sev} ${s[`sev_${tone}`]}`}>
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d={BADGE_ICON[tone]} clipRule="evenodd" /></svg>
      {label}
    </span>
  );
}

/** Page numbers to show: first, last, and a window around the current page, with gaps. */
function pageList(page, pageCount) {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const list = [...pages].filter(p => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  return list.flatMap((p, i) => (i > 0 && p - list[i - 1] > 1 ? ['gap', p] : [p]));
}

/** "Showing 21–40 of 59" + Previous / page numbers / Next. Changes page in place (no reload). */
export function Pagination({ page, pageCount, total, pageSize, onPage, label }) {
  if (pageCount <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <nav className={s.pager} aria-label={`${label} pages`}>
      <span className={s.pagerInfo} aria-live="polite">Showing {first}–{last} of {total}</span>
      <div className={s.pagerButtons}>
        <button type="button" className={s.pageBtn} onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Previous page">Previous</button>
        {pageList(page, pageCount).map((p, i) => (p === 'gap'
          ? <span key={`gap-${i}`} className={s.pageGap} aria-hidden="true">…</span>
          : <button key={p} type="button" className={s.pageBtn} onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined} aria-label={`Page ${p}`}>{p}</button>))}
        <button type="button" className={s.pageBtn} onClick={() => onPage(page + 1)} disabled={page === pageCount} aria-label="Next page">Next</button>
      </div>
    </nav>
  );
}

/**
 * A report card with a table.
 * columns: [{ label, align?: 'right', className?, render: (row, index) => node }]
 * pageSize: show this many rows at a time, with pagination under the table.
 */
export function ReportTable({ id, title, columns, rows, rowKey, empty, footer, actions, pageSize }) {
  // A new rows array (new data / filter) starts again at page 1.
  const [pager, setPager] = useState({ rows, page: 1 });
  const wrapRef = useRef(null);
  const pageCount = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const page = pager.rows === rows ? Math.min(pager.page, pageCount) : 1;
  const start = pageSize ? (page - 1) * pageSize : 0;
  const visible = pageSize ? rows.slice(start, start + pageSize) : rows;
  const goTo = (p) => {
    setPager({ rows, page: Math.min(Math.max(1, p), pageCount) });
    if (wrapRef.current) wrapRef.current.scrollTop = 0;
  };
  const cls = c => [c.align === 'right' ? s.num : '', c.className || ''].join(' ').trim() || undefined;

  return (
    <section className={s.card} aria-labelledby={id}>
      <div className={s.cardHead}>
        <h2 id={id} className={s.cardTitle}>{title}</h2>
        {actions}
      </div>
      {rows.length === 0 ? <p className={s.empty}>{empty}</p> : (
        <div ref={wrapRef} className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>{columns.map(c => <th key={c.label} className={cls(c)}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {visible.map((r, i) => (
                <tr key={rowKey ? rowKey(r, start + i) : start + i}>
                  {columns.map(c => <td key={c.label} className={cls(c)}>{c.render(r, start + i)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pageSize > 0 && <Pagination page={page} pageCount={pageCount} total={rows.length} pageSize={pageSize} onPage={goTo} label={title} />}
      {footer}
    </section>
  );
}

/**
 * Period filter state + loading the report from `endpoint` (GET <base>/<endpoint>;
 * base 'report' = super admin reports, 'org-report' = store owner reports)
 * whenever the period or `params` change.
 * @returns {{ period, setPeriod, custom, setCustom, range, customInvalid, report, loading, error, startLoading }}
 */
export function useReport(endpoint, params = {}, defaultPeriod = 'this-year', base = 'report') {
  const [period, setPeriodState] = useState(defaultPeriod);
  const [custom, setCustomState] = useState(() => periodRange('this-month'));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const range = period === 'custom' ? custom : periodRange(period);
  const customInvalid = Boolean(period === 'custom' && custom.from && custom.to && custom.from > custom.to);
  const paramKey = JSON.stringify(params);

  useEffect(() => {
    if (customInvalid) return undefined;
    let cancelled = false;
    const qs = new URLSearchParams();
    if (range.from) qs.set('from', range.from);
    if (range.to) qs.set('to', range.to);
    Object.entries(JSON.parse(paramKey)).forEach(([k, v]) => { if (v) qs.set(k, v); });
    qs.set('t', String(Date.now()));
    apiServiceHandler('GET', `${base}/${endpoint}?${qs}`)
      .then(res => { if (!cancelled) { setReport(res?.data || null); setError(''); } })
      .catch(err => { if (!cancelled) setError(err?.message || 'Failed to load the report.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [base, endpoint, range.from, range.to, paramKey, customInvalid]);

  const startLoading = () => setLoading(true);
  const setPeriod = (p) => { startLoading(); setPeriodState(p); };
  const setCustom = (fn) => { startLoading(); setCustomState(fn); };
  return { period, setPeriod, custom, setCustom, range, customInvalid, report, loading, error, startLoading };
}

/** Period select (+ From / To when "Custom range"). `label` names what the period filters. */
export function PeriodFields({ state, label = 'Period' }) {
  const { period, setPeriod, custom, setCustom } = state;
  return (
    <>
      <label className={s.field}>
        <span>{label}</span>
        <select value={period} onChange={e => setPeriod(e.target.value)}>
          {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>
      {period === 'custom' && (
        <>
          <label className={s.field}>
            <span>From</span>
            <input type="date" value={custom.from} max={custom.to || todayYMD()} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} />
          </label>
          <label className={s.field}>
            <span>To</span>
            <input type="date" value={custom.to} min={custom.from || undefined} max={todayYMD()} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} />
          </label>
        </>
      )}
    </>
  );
}
