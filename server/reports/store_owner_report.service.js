import Organization from '../organizations/organization.model.js';
import { REPORT_TIMEZONE, startOfDayIST } from './report.service.js';

const monthKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIMEZONE, year: 'numeric', month: '2-digit' })
  .format(date).slice(0, 7);

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

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const clean = (v) => (typeof v === 'string' ? v.trim() : '') || null;

/**
 * Store owner (organization) report: the organizations registered in the
 * period (inclusive dates, India time; none = all time), with their location,
 * owner, learners, courses and lifetime revenue.
 * @param {{ from?: string, to?: string }} filters 'YYYY-MM-DD'
 */
export async function getStoreOwnerReport({ from, to } = {}) {
  const match = { deletedAt: null };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = startOfDayIST(from);
    if (to) {
      const end = startOfDayIST(to);
      end.setUTCDate(end.getUTCDate() + 1);
      match.createdAt.$lt = end;
    }
  }

  const rows = await Organization.aggregate([
    { $match: match },
    { $project: { org_name: 1, org_email: 1, org_city: 1, org_state: 1, org_country: 1, status: 1, createdAt: 1, ownerId: 1 } },
    { $lookup: { from: 'users', localField: 'ownerId', foreignField: '_id', as: 'owner', pipeline: [{ $project: { name: 1, email: 1 } }] } },
    { $lookup: {
      from: 'users', localField: '_id', foreignField: 'orgId', as: 'learnerStats',
      pipeline: [
        { $match: { user_type: 'employee', deletedAt: null } },
        { $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } } },
      ],
    } },
    { $lookup: {
      from: 'organization_courses', localField: '_id', foreignField: 'orgId', as: 'courseStats',
      pipeline: [{ $match: { status: 'active' } }, { $count: 'n' }],
    } },
    { $lookup: {
      from: 'orders', localField: '_id', foreignField: 'organizer_id', as: 'orderStats',
      pipeline: [{ $match: { deletedAt: null, status: 'success' } }, { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$credit_amount' } } }],
    } },
    { $sort: { createdAt: -1 } },
  ]);

  const organizations = rows.map(o => ({
    _id: o._id,
    name: clean(o.org_name) || 'Unnamed organization',
    email: clean(o.org_email),
    owner: o.owner[0] ? { name: clean(o.owner[0].name), email: clean(o.owner[0].email) } : null,
    city: clean(o.org_city),
    state: clean(o.org_state),
    country: clean(o.org_country),
    status: o.status || 'active',
    registeredAt: o.createdAt,
    learners: o.learnerStats[0]?.total || 0,
    activeLearners: o.learnerStats[0]?.active || 0,
    courses: o.courseStats[0]?.n || 0,
    orders: o.orderStats[0]?.orders || 0,
    revenue: round2(o.orderStats[0]?.revenue),
  }));

  const count = (status) => organizations.filter(o => o.status === status).length;
  const thisMonth = monthKey(new Date());

  // Registrations per month over the period (empty months included).
  const byMonth = new Map();
  for (const o of organizations) {
    const k = monthKey(o.registeredAt);
    byMonth.set(k, (byMonth.get(k) || 0) + 1);
  }
  const keys = [...byMonth.keys()].sort();
  const firstMonth = from ? monthKey(startOfDayIST(from)) : keys[0];
  const lastMonth = to ? monthKey(startOfDayIST(to)) : (keys.length ? (thisMonth > keys[keys.length - 1] ? thisMonth : keys[keys.length - 1]) : null);
  const monthly = firstMonth && lastMonth && firstMonth <= lastMonth
    ? monthsBetween(firstMonth, lastMonth).map(month => ({ month, registered: byMonth.get(month) || 0 }))
    : [];

  // Location: by state, and by city (within state).
  const group = (keyOf) => {
    const map = new Map();
    for (const o of organizations) {
      const key = keyOf(o);
      const g = map.get(key) || { organizations: 0, active: 0, learners: 0 };
      g.organizations += 1;
      if (o.status === 'active') g.active += 1;
      g.learners += o.learners;
      map.set(key, g);
    }
    const total = organizations.length || 1;
    return [...map.entries()]
      .map(([key, g]) => ({ ...JSON.parse(key), ...g, share: Math.round((g.organizations / total) * 1000) / 10 }))
      .sort((a, b) => b.organizations - a.organizations || b.learners - a.learners);
  };
  const byState = group(o => JSON.stringify({ state: o.state }));
  const byCity = group(o => JSON.stringify({ city: o.city, state: o.state }));

  return {
    period: { from: from || null, to: to || null, timezone: REPORT_TIMEZONE },
    totals: {
      registered: organizations.length,
      active: count('active'),
      inactive: count('inactive'),
      suspended: count('suspended'),
      registeredThisMonth: organizations.filter(o => monthKey(o.registeredAt) === thisMonth).length,
      learners: organizations.reduce((sum, o) => sum + o.learners, 0),
      withoutLocation: organizations.filter(o => !o.city && !o.state).length,
    },
    monthly,
    organizations,
    byState,
    byCity,
    generatedAt: new Date(),
  };
}

