// Shared by the report pages (Revenue, Store Owner) and their PDF exports.

export const TIMEZONE = 'Asia/Kolkata';

/** ₹1,234.50 (page) — the PDF uses "Rs." because its built-in font has no ₹ glyph. */
export function money(value, symbol = '₹') {
  const n = Number(value) || 0;
  return `${symbol}${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Whole-rupee short form for axis labels: ₹1.2K, ₹3.4L. */
export function moneyShort(value, symbol = '₹') {
  const n = Number(value) || 0;
  if (n >= 1e7) return `${symbol}${(n / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (n >= 1e5) return `${symbol}${(n / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  if (n >= 1e3) return `${symbol}${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return `${symbol}${Math.round(n)}`;
}

/** A tidy axis maximum (1, 2, 2.5 or 5 × a power of ten) at or above `max`. */
export function niceMax(max) {
  if (max <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(max));
  const f = max / exp;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return step * exp;
}

/** 'YYYY-MM' → 'Jun 2026' (or 'Jun 26' when short). */
export function monthLabel(ym, short = false) {
  const [y, m] = ym.split('-').map(Number);
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });
  return short ? `${name} ${String(y).slice(2)}` : `${name} ${y}`;
}

/** 'YYYY-MM-DD' → '19 Jun 2026' (or '19 Jun' when short). */
export function dayLabel(ymd, short = false) {
  const d = new Date(`${ymd}T12:00:00Z`);
  return d.toLocaleDateString('en-IN', short ? { day: '2-digit', month: 'short', timeZone: 'UTC' } : { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Date → '24 Sep 2026' in India time. */
export function dateLabel(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TIMEZONE });
}

/** 'YYYY-MM-DD' → '24 Sep 2026'. */
export function ymdLabel(ymd) {
  return ymd ? dateLabel(`${ymd}T12:00:00+05:30`) : '';
}

/** Today in India time as 'YYYY-MM-DD'. */
export function todayYMD() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const pad = n => String(n).padStart(2, '0');

export const PERIODS = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-3-months', label: 'Last 3 months' },
  { value: 'last-6-months', label: 'Last 6 months' },
  { value: 'this-year', label: 'This year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

/** { from, to } ('YYYY-MM-DD', India time) for a period preset; empty for "All time". */
export function periodRange(period, today = todayYMD()) {
  const [y, m] = today.split('-').map(Number);
  const monthsBack = { 'this-month': 0, 'last-3-months': 2, 'last-6-months': 5 }[period];
  if (monthsBack !== undefined) {
    const start = new Date(Date.UTC(y, m - 1 - monthsBack, 1));
    return { from: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-01`, to: today };
  }
  if (period === 'this-year') return { from: `${y}-01-01`, to: today };
  return { from: '', to: '' };
}

/** Human description of the period, e.g. "1 Jun 2026 – 12 Oct 2026" or "All time". */
export function periodText(from, to) {
  if (!from && !to) return 'All time';
  if (from && to) return `${ymdLabel(from)} – ${ymdLabel(to)}`;
  return from ? `From ${ymdLabel(from)}` : `Until ${ymdLabel(to)}`;
}

export const STATUS_LABEL = { success: 'Success', pending: 'Pending', failed: 'Failed', refunded: 'Refunded', canceled: 'Canceled' };

export function gatewayLabel(value) {
  if (!value) return 'Manual';
  return String(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Revenue report points for 'monthly' or 'daily': [{ key, label, shortLabel, revenue, orders, aov }] */
export function revenueSeries(report, view) {
  if (view === 'daily') return (report.daily || []).map(d => ({ ...d, label: dayLabel(d.key), shortLabel: dayLabel(d.key, true) }));
  return (report.monthly || []).map(m => ({ ...m, label: monthLabel(m.key), shortLabel: monthLabel(m.key, true) }));
}
