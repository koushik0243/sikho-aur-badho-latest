import { startOfDayIST } from './report.service.js';

// Small helpers shared by the learning reports.

export const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null);
export const round1 = (n) => Math.round(n * 10) / 10;
export const avg = (list) => (list.length ? round1(list.reduce((s, v) => s + v, 0) / list.length) : null);
export const median = (list) => {
  if (!list.length) return null;
  const v = [...list].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return round1(v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2);
};

/** An attempt's score in % (totalScore out of the answers' max marks). */
export const scorePct = (a) => {
  const max = (a.answers || []).reduce((s, x) => s + (Number(x.maxScore) || 0), 0);
  const score = Number(a.totalScore) || 0;
  return max > 0 ? Math.min(100, (score / max) * 100) : Math.min(100, score);
};

/** Mongo date range for ?from=&to= (IST days, `to` inclusive), or null for all time. */
export function dateRange(from, to) {
  if (!from && !to) return null;
  const range = {};
  if (from) range.$gte = startOfDayIST(from);
  if (to) { const end = startOfDayIST(to); end.setUTCDate(end.getUTCDate() + 1); range.$lt = end; }
  return range;
}
export const inRange = (date, range) => !range || ((!range.$gte || date >= range.$gte) && (!range.$lt || date < range.$lt));
