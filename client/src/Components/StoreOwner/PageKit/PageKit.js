'use client';

import k from './PageKit.module.css';
import dk from './DetailKit.module.css';
import fk from './FormKit.module.css';

// Shared building blocks for the store owner list pages (Current Credit,
// Credits Usage, Support, Orders, Invoices): page header, KPI tiles, cards,
// status pills and pagination — so the pages look and behave alike.

export { k as kit };

/** @param {{ title: string, sub?: string, actions?: import('react').ReactNode }} props */
export function PageHeader({ title, sub, actions }) {
  return (
    <header className={k.pageHead}>
      <div>
        <h1 className={k.pageTitle}>{title}</h1>
        {sub && <p className={k.pageSub}>{sub}</p>}
      </div>
      {actions && <div className={k.pageActions}>{actions}</div>}
    </header>
  );
}

/**
 * @param {{ items: Array<{ label: string, value: import('react').ReactNode, icon?: import('react').ReactNode,
 *   hint?: string, tone?: 'good'|'warn'|'bad'|'info'|'' }>, label?: string }} props
 */
export function KpiTiles({ items, label = 'Overview' }) {
  return (
    <section className={k.kpis} aria-label={label}>
      {items.map(it => (
        <div key={it.label} className={`${k.kpi} ${it.tone ? k[`kpi_${it.tone}`] : ''}`}>
          {it.icon && <span className={k.kpiIcon} aria-hidden="true">{it.icon}</span>}
          <div className={k.kpiText}>
            <div className={k.kpiValue}>{it.value}</div>
            <div className={k.kpiLabel}>{it.label}</div>
            {it.hint && <div className={k.kpiHint}>{it.hint}</div>}
          </div>
        </div>
      ))}
    </section>
  );
}

/**
 * @param {{ title?: string, sub?: string, meta?: import('react').ReactNode, id?: string,
 *   children: import('react').ReactNode, flush?: boolean, className?: string }} props
 *   flush — no body padding (for tables that run edge to edge)
 */
export function Card({ title, sub, meta, id, children, flush = false, className = '' }) {
  const headId = id ? `${id}-h` : undefined;
  return (
    <section className={`${k.card} ${className}`} aria-labelledby={title ? headId : undefined}>
      {title && (
        <div className={k.cardHead}>
          <div>
            <h2 id={headId} className={k.cardTitle}>{title}</h2>
            {sub && <p className={k.cardSub}>{sub}</p>}
          </div>
          {meta && <div className={k.cardMeta}>{meta}</div>}
        </div>
      )}
      <div className={flush ? undefined : k.cardBody}>{children}</div>
    </section>
  );
}

/** @param {{ tone?: 'good'|'warn'|'bad'|'info'|'neutral', children: import('react').ReactNode }} props */
export function Pill({ tone = 'neutral', children }) {
  return <span className={`${k.pill} ${k[`pill_${tone}`]}`}>{children}</span>;
}

/**
 * Footer with the "Showing x–y of n" text, optional left content and page buttons.
 * @param {{ page: number, pageSize: number, total: number, onPage: (p: number) => void, left?: import('react').ReactNode }} props
 */
export function Pager({ page, pageSize, total, onPage, left }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className={k.pager}>
      <div className={k.pagerLeft}>
        {left}
        <span>{total === 0 ? 'No records' : `Showing ${from}–${to} of ${total}`}</span>
      </div>
      {totalPages > 1 && (
        <nav className={k.pagerBtns} aria-label="Pagination">
          <button type="button" className={k.pageBtn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">Previous</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} type="button" className={`${k.pageBtn} ${p === page ? k.pageBtnActive : ''}`}
              onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined}>{p}</button>
          ))}
          <button type="button" className={k.pageBtn} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">Next</button>
        </nav>
      )}
    </div>
  );
}

/** Placeholder rows while a table loads. */
export function SkeletonRows({ rows = 4, cols }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i}><td colSpan={cols}><div className={k.skeleton} /></td></tr>
  ));
}

export const KitIcon = {
  cart:     <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg>,
  check:    <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
  clock:    <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>,
  x:        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>,
  doc:      <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>,
  coins:    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" /></svg>,
  users:    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>,
  layers:   <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2L2 6l8 4 8-4-8-4zM2 10l8 4 8-4M2 14l8 4 8-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" /></svg>,
  ticket:   <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2a2 2 0 100-4V6z" /></svg>,
  spark:    <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>,
  eye:      <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>,
  trash:    <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>,
  search:   <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>,
};

/** Adds each kit class next to the page's class of the same name (kit classes win). */
function layer(styles, kit) {
  const merged = { ...styles };
  for (const [key, cls] of Object.entries(kit)) merged[key] = styles[key] ? `${styles[key]} ${cls}` : cls;
  return merged;
}

/**
 * A detail page's own CSS module with the shared detail styles layered on top, so
 * all store owner detail pages share one look. Usage: `const vp = withDetailKit(pageStyles)`.
 */
export const withDetailKit = styles => layer(styles, dk);

/** Same idea for the store owner form pages (Edit / Add learner, Profile, Assign courses). */
export const withFormKit = styles => layer(styles, fk);
