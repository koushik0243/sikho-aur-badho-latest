// What a listing shows when a column has no value (every table, all accounts).
export const EMPTY_VALUE = '—';

/**
 * `value`, or "—" when there's nothing to show: null/undefined, an empty or
 * whitespace-only string, an empty array, or NaN. Real values are kept as-is —
 * including 0 and false, so counts and amounts still show "0".
 */
export function orDash(value) {
  if (value === null || value === undefined) return EMPTY_VALUE;
  if (typeof value === 'string') return value.trim() ? value : EMPTY_VALUE;
  if (typeof value === 'number') return Number.isNaN(value) ? EMPTY_VALUE : value;
  if (Array.isArray(value)) return value.length ? value : EMPTY_VALUE;
  return value;
}
