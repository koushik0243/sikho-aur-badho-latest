'use client';

// The label / value rows on a SuperAdmin view (details) page. Every field is
// always listed — an empty value shows "—" — so all view pages read the same.

const isEmpty = v => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * @param {{
 *   rows: Array<{ label: string, value?: import('react').ReactNode, variant?: 'desc'|'mono' }>,
 *   s: Record<string, string>,   // the page's CSS module (detailRows / detailRow / detailLabel / detailValue…)
 * }} props
 */
export default function ViewDetailRows({ rows, s }) {
  const valueClass = variant => {
    if (variant === 'mono') return s.detailValueMono || s.detailValue;
    if (variant === 'desc') return [s.detailValue, s.detailValueDesc].filter(Boolean).join(' ');
    return s.detailValue;
  };
  return (
    <div className={s.detailRows}>
      {rows.map(({ label, value, variant }) => (
        <div key={label} className={s.detailRow}>
          <span className={s.detailLabel}>{label}</span>
          <span className={valueClass(variant)}>{isEmpty(value) ? '—' : value}</span>
        </div>
      ))}
    </div>
  );
}

/** "active" → "Active" */
export const capitalize = v => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '');
