import mongoose from 'mongoose';
import Order from '../orders/order.model.js';

// Revenue = credit-package orders with status 'success'. Months and
// days are counted in India time so an order at 00:30 IST lands on the right day.
export const REPORT_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET = '+05:30';
const MAX_DAILY_DAYS = 366; // longer periods are shown monthly only

/** 'YYYY-MM-DD' (India time) → Date at the start of that day. */
export const startOfDayIST = (ymd) => new Date(`${ymd}T00:00:00${IST_OFFSET}`);

export const dayKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const monthKey = (date) => dayKey(date).slice(0, 7);

function monthsBetween(first, last) {
  const out = [];
  let [y, m] = first.split('-').map(Number);
  const [ly, lm] = last.split('-').map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

function daysBetween(first, last) {
  const out = [];
  const d = new Date(`${first}T00:00:00Z`);
  const end = new Date(`${last}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const aov = (revenue, orders) => (orders ? round2(revenue / orders) : 0);

/** Mongo date filter for inclusive 'YYYY-MM-DD' dates (India time). */
function dateRange(from, to) {
  if (!from && !to) return null;
  const range = {};
  if (from) range.$gte = startOfDayIST(from);
  if (to) {
    const end = startOfDayIST(to);
    end.setUTCDate(end.getUTCDate() + 1); // whole "to" day included
    range.$lt = end;
  }
  return range;
}

/**
 * Course-wise revenue: each organization's paid revenue in the period is split
 * across the courses it used credits on in the period, in proportion to the
 * credits used per course (one credit = one course assigned to one learner).
 * Revenue of organizations that used no credits is "not yet used on a course".
 */
export async function courseWiseRevenue(orgRevenue, range) {
  const usageMatch = { deletedAt: null };
  if (range) usageMatch.createdAt = range;
  const db = mongoose.connection.db;
  const uses = await db.collection('credit_useds').aggregate([
    { $match: usageMatch },
    { $group: { _id: { org: '$orgId', course: '$courseId' }, credits: { $sum: 1 } } },
  ]).toArray();

  const usesByOrg = new Map();
  for (const u of uses) {
    const org = String(u._id.org);
    usesByOrg.set(org, (usesByOrg.get(org) || 0) + u.credits);
  }

  const courses = new Map(); // courseId → { credits, revenue, orgs:Set }
  for (const u of uses) {
    const key = u._id.course ? String(u._id.course) : 'none';
    const c = courses.get(key) || { credits: 0, revenue: 0, orgs: new Set() };
    c.credits += u.credits;
    c.orgs.add(String(u._id.org));
    const paid = orgRevenue.get(String(u._id.org)) || 0;
    c.revenue += paid * (u.credits / usesByOrg.get(String(u._id.org)));
    courses.set(key, c);
  }
  let unallocated = 0;
  for (const [org, revenue] of orgRevenue) if (!usesByOrg.get(org)) unallocated += revenue;

  // Round to paise so the course figures + unallocated add up exactly to the
  // period's revenue (largest-remainder rounding).
  const parts = [...courses.entries()].map(([id, c]) => ({ id, raw: c.revenue * 100 }));
  parts.push({ id: '__unallocated', raw: unallocated * 100 });
  const target = Math.round([...orgRevenue.values()].reduce((a, b) => a + b, 0) * 100);
  parts.forEach(x => { x.paise = Math.floor(x.raw + 1e-9); });
  let leftover = target - parts.reduce((a, x) => a + x.paise, 0);
  [...parts].sort((a, b) => (b.raw - Math.floor(b.raw + 1e-9)) - (a.raw - Math.floor(a.raw + 1e-9)) || a.id.localeCompare(b.id)) // ties: stable by id
    .forEach(x => { if (leftover > 0) { x.paise += 1; leftover -= 1; } });
  const paise = new Map(parts.map(x => [x.id, x.paise]));

  const ids = [...courses.keys()].filter(k => k !== 'none').map(k => new mongoose.Types.ObjectId(k));
  const titles = new Map((await db.collection('courses').find({ _id: { $in: ids } }).project({ title: 1 }).toArray())
    .map(c => [String(c._id), c.title]));

  return {
    rows: [...courses.entries()].map(([id, c]) => ({
      courseId: id === 'none' ? null : id,
      title: id === 'none' ? 'No course recorded' : (titles.get(id) || 'Deleted course'),
      credits: c.credits,
      organizations: c.orgs.size,
      revenue: paise.get(id) / 100,
    })).sort((a, b) => b.revenue - a.revenue || b.credits - a.credits || a.title.localeCompare(b.title)),
    unallocated: paise.get('__unallocated') / 100,
    creditsUsed: uses.reduce((sum, u) => sum + u.credits, 0),
  };
}

/**
 * Revenue report: revenue (monthly + daily), AOV, course-wise revenue.
 * @param {{ from?: string, to?: string }} filters 'YYYY-MM-DD' dates, inclusive (India time)
 */
export async function getRevenueReport({ from, to } = {}) {
  const range = dateRange(from, to);
  const match = { deletedAt: null, status: 'success' };
  if (range) match.purchase_date = range;

  const [result] = await Order.aggregate([
    { $match: match },
    {
      $facet: {
        totals: [{ $group: { _id: null, revenue: { $sum: '$credit_amount' }, orders: { $sum: 1 } } }],
        monthly: [{ $group: { _id: { $dateToString: { format: '%Y-%m', date: '$purchase_date', timezone: REPORT_TIMEZONE } }, revenue: { $sum: '$credit_amount' }, orders: { $sum: 1 } } }],
        daily: [{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$purchase_date', timezone: REPORT_TIMEZONE } }, revenue: { $sum: '$credit_amount' }, orders: { $sum: 1 } } }],
        byOrg: [{ $group: { _id: '$organizer_id', revenue: { $sum: '$credit_amount' } } }],
        range: [{ $group: { _id: null, first: { $min: '$purchase_date' }, last: { $max: '$purchase_date' } } }],
      },
    },
  ]);

  const totals = result.totals[0] || { revenue: 0, orders: 0 };
  const span = result.range[0];
  const today = dayKey(new Date());
  const firstDay = from || (span ? dayKey(span.first) : null);
  const lastDay = to || (span ? (dayKey(span.last) > today ? dayKey(span.last) : today) : null);

  const series = (rows, keys) => {
    const byKey = new Map(rows.map(r => [r._id, r]));
    return keys.map(key => {
      const r = byKey.get(key);
      return { key, revenue: round2(r?.revenue), orders: r?.orders || 0, aov: aov(r?.revenue || 0, r?.orders || 0) };
    });
  };
  const monthly = firstDay && lastDay ? series(result.monthly, monthsBetween(firstDay.slice(0, 7), lastDay.slice(0, 7))) : [];
  const dayKeys = firstDay && lastDay ? daysBetween(firstDay, lastDay) : [];
  const daily = dayKeys.length <= MAX_DAILY_DAYS ? series(result.daily, dayKeys) : null;

  const orgRevenue = new Map(result.byOrg.map(o => [String(o._id), o.revenue]));
  const byCourse = await courseWiseRevenue(orgRevenue, range);

  return {
    period: { from: from || null, to: to || null, timezone: REPORT_TIMEZONE },
    totals: { revenue: round2(totals.revenue), orders: totals.orders, averageOrder: aov(totals.revenue, totals.orders) },
    monthly,
    daily,                 // null when the period is longer than MAX_DAILY_DAYS
    maxDailyDays: MAX_DAILY_DAYS,
    byCourse,
    generatedAt: new Date(),
  };
}

