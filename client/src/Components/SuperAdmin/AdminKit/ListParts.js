import ak from './AdminKit.module.css';

/**
 * Small shared pieces of every super admin list page: sort arrows, loading rows,
 * the empty state, shortened pagination and the "+" of the add button.
 * Styles live in AdminKit.module.css ("List parts").
 */

const SKELETON_ROWS = 6;
const MAX_PAGES_SHOWN_IN_FULL = 7;
// Bar widths cycle per column so the placeholder rows don't look like a solid block.
const SKELETON_WIDTHS = ['55%', '70%', '45%', '60%', '40%'];

/** Up / down arrows next to a sortable column title; the active direction is highlighted. */
export function SortArrow({ active, dir }) {
  return (
    <svg className={ak.sortIcon} viewBox="0 0 10 14" aria-hidden="true">
      <path className={active && dir === 'asc' ? ak.sortOn : undefined} d="M5 1l4 4.5H1z" />
      <path className={active && dir === 'desc' ? ak.sortOn : undefined} d="M5 13l4-4.5H1z" />
    </svg>
  );
}

/** Placeholder rows shown in a table body while its data loads. */
export function SkeletonRows({ columns, rows = SKELETON_ROWS }) {
  const columnCount = Math.max(1, Number(columns) || 1);
  return Array.from({ length: rows }, (_, row) => (
    <tr key={row} className={ak.skeletonRow} aria-hidden="true">
      {Array.from({ length: columnCount }, (__, col) => (
        <td key={col}>
          <span className={ak.skeleton} style={{ width: SKELETON_WIDTHS[(row + col) % SKELETON_WIDTHS.length] }} />
        </td>
      ))}
    </tr>
  ));
}

/** Icon + message for a table with nothing to show (goes inside the full-width cell). */
export function EmptyState({ children }) {
  return (
    <div className={ak.emptyState}>
      <span className={ak.emptyIcon}>
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v7h-2l-1 2H8l-1-2H5V5z" clipRule="evenodd" />
        </svg>
      </span>
      <p className={ak.emptyTitle}>{children}</p>
    </div>
  );
}

/**
 * Page buttons to show: every page while there are few, otherwise the first, the last and
 * the pages around the current one. A gap is returned as a string ("gap-12") — render it
 * with <PageGap />.
 * @param {number} current
 * @param {number} totalPages
 * @returns {(number|string)[]}
 */
export function pageItems(current, totalPages) {
  const lastPage = Math.max(1, Number(totalPages) || 1);
  if (lastPage <= MAX_PAGES_SHOWN_IN_FULL) return Array.from({ length: lastPage }, (_, i) => i + 1);
  const wanted = [1, current - 1, current, current + 1, lastPage].filter(p => p >= 1 && p <= lastPage);
  const pages = [...new Set(wanted)].sort((a, b) => a - b);
  const items = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) items.push(`gap-${p}`);
    items.push(p);
  });
  return items;
}

/** The "…" between page buttons. */
export function PageGap() {
  return <span className={ak.pageGap} aria-hidden="true">…</span>;
}

/** The plus sign in front of an "Add …" button label. */
export function PlusIcon() {
  return (
    <svg className={ak.plusIcon} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * Footer count: "Showing 1 to 10 of 42 tags" with the numbers in bold, or "No tags".
 * @param {{ from: number, to: number, total: number, singular: string, plural: string }} props
 */
export function ResultCount({ from, to, total, singular, plural }) {
  if (!total) return <span className={ak.resultCount}>No {plural}</span>;
  return (
    <span className={ak.resultCount}>
      Showing <strong>{from}</strong> to <strong>{to}</strong> of <strong>{total}</strong> {total !== 1 ? plural : singular}
    </span>
  );
}

/** Bin icon in front of "Delete Selected (N)". */
export function TrashIcon() {
  return (
    <svg className={ak.trashIcon} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}
