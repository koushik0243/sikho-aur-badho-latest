import mongoose from 'mongoose';
import { REPORT_TIMEZONE } from './report.service.js';
import { pct, dateRange } from './report_stats.js';
import { loadEnrollments } from './trainee_report.service.js';

const { ObjectId } = mongoose.Types;
const DAY_MS = 24 * 60 * 60 * 1000;
const TOP = 10;

// VIP = the top VIP_SHARE of paying organizations by lifetime spend (at least 1, at most VIP_MAX).
// Their status comes from the last successful order.
export const VIP_RULES = { VIP_SHARE: 20, VIP_MAX: 10, ACTIVE_DAYS: 90, AT_RISK_DAYS: 180 };

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const clean = (v) => (typeof v === 'string' ? v.trim() : '') || null;
const place = (o) => [clean(o?.org_city), clean(o?.org_state)].filter(Boolean).join(', ') || null;

function vipStatus(lastOrder, now) {
  const days = Math.floor((now - new Date(lastOrder).getTime()) / DAY_MS);
  if (days <= VIP_RULES.ACTIVE_DAYS) return { status: 'active', daysSinceOrder: days };
  if (days <= VIP_RULES.AT_RISK_DAYS) return { status: 'cooling', daysSinceOrder: days };
  return { status: 'at_risk', daysSinceOrder: days };
}

/** Successful orders grouped by organization (optionally in a period). */
const ordersByOrg = (range) => mongoose.connection.db.collection('orders').aggregate([
  { $match: { deletedAt: null, status: 'success', ...(range ? { purchase_date: range } : {}) } },
  { $group: {
    _id: '$organizer_id',
    revenue: { $sum: '$credit_amount' },
    orders: { $sum: 1 },
    first: { $min: '$purchase_date' },
    last: { $max: '$purchase_date' },
  } },
]).toArray();

/** Enrollment counts per organization from loadEnrollments rows. */
function enrollmentStats(rows) {
  const byOrg = new Map();
  for (const r of rows) {
    if (!r.orgId) continue;
    const g = byOrg.get(r.orgId) || { orgId: r.orgId, enrollments: 0, learners: new Set(), courses: new Set(), completed: 0, inProgress: 0, notStarted: 0, dropout: 0 };
    g.enrollments += 1;
    g.learners.add(r.learnerId);
    g.courses.add(r.courseId);
    if (r.status === 'completed') g.completed += 1;
    else if (r.status === 'in_progress') g.inProgress += 1;
    else if (r.status === 'not_started') g.notStarted += 1;
    else g.dropout += 1;
    byOrg.set(r.orgId, g);
  }
  return byOrg;
}

/**
 * Top organizations: top 10 by revenue and by enrollments in the period, and
 * VIP customers (lifetime spend, whatever the period).
 * @param {{ from?: string, to?: string }} filters 'YYYY-MM-DD', inclusive (India time)
 */
export async function getTopOrganizationsReport({ from, to } = {}) {
  const db = mongoose.connection.db;
  const range = dateRange(from, to);
  const now = Date.now();

  const [periodOrders, lifetimeOrders, periodEnrollments, lifetimeEnrollments] = await Promise.all([
    ordersByOrg(range),
    range ? ordersByOrg(null) : null,
    loadEnrollments({ from, to }),
    range ? loadEnrollments({}) : null,
  ]);
  const lifetime = lifetimeOrders || periodOrders;
  const periodEnr = enrollmentStats(periodEnrollments.rows);
  const lifetimeEnr = range ? enrollmentStats(lifetimeEnrollments.rows) : periodEnr;

  const orgIds = [...new Set([...lifetime.map(o => String(o._id)), ...lifetimeEnr.keys()])].filter(id => mongoose.isValidObjectId(id));
  const orgs = await db.collection('organizations').find({ _id: { $in: orgIds.map(id => new ObjectId(id)) } })
    .project({ org_name: 1, org_city: 1, org_state: 1, status: 1, createdAt: 1, deletedAt: 1 }).toArray();
  const orgInfo = new Map(orgs.map(o => [String(o._id), o]));
  const nameOf = id => {
    const o = orgInfo.get(String(id));
    if (!o) return 'Deleted organization';
    return `${clean(o.org_name) || 'Unnamed organization'}${o.deletedAt ? ' (deleted)' : ''}`;
  };
  const base = id => ({ orgId: String(id), name: nameOf(id), location: place(orgInfo.get(String(id))), orgStatus: orgInfo.get(String(id))?.status || null });

  // ── Top 10 by revenue (period) ────────────────────────
  const totalRevenue = round2(periodOrders.reduce((s, o) => s + o.revenue, 0));
  const totalOrders = periodOrders.reduce((s, o) => s + o.orders, 0);
  const byRevenue = periodOrders
    .map(o => ({ ...base(o._id), revenue: round2(o.revenue), orders: o.orders, aov: o.orders ? round2(o.revenue / o.orders) : 0, lastOrder: o.last, share: pct(o.revenue, totalRevenue) ?? 0 }))
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders || a.name.localeCompare(b.name));
  const topRevenue = byRevenue.slice(0, TOP).map((r, i) => ({ rank: i + 1, ...r }));
  const topRevenueSum = round2(topRevenue.reduce((s, r) => s + r.revenue, 0));
  const otherRevenue = byRevenue.slice(TOP);

  // ── Top 10 by enrollments (period) ────────────────────
  const totalEnrollments = periodEnrollments.rows.length;
  const byEnrollment = [...periodEnr.values()]
    .map(g => ({
      ...base(g.orgId),
      enrollments: g.enrollments, learners: g.learners.size, courses: g.courses.size,
      completed: g.completed, inProgress: g.inProgress, notStarted: g.notStarted, dropout: g.dropout,
      completionRate: pct(g.completed, g.enrollments) ?? 0,
      share: pct(g.enrollments, totalEnrollments) ?? 0,
    }))
    .sort((a, b) => b.enrollments - a.enrollments || b.learners - a.learners || a.name.localeCompare(b.name));
  const topEnrollment = byEnrollment.slice(0, TOP).map((r, i) => ({ rank: i + 1, ...r }));
  const otherEnrollment = byEnrollment.slice(TOP);

  // ── VIP customers (lifetime) ──────────────────────────
  const paying = lifetime.filter(o => o.revenue > 0).sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);
  const lifetimeRevenue = round2(paying.reduce((s, o) => s + o.revenue, 0));
  const vipCount = paying.length ? Math.min(VIP_RULES.VIP_MAX, Math.max(1, Math.ceil(paying.length * VIP_RULES.VIP_SHARE / 100))) : 0;
  const vips = paying.slice(0, vipCount).map((o, i) => {
    const e = lifetimeEnr.get(String(o._id));
    return {
      rank: i + 1,
      ...base(o._id),
      revenue: round2(o.revenue),
      share: pct(o.revenue, lifetimeRevenue) ?? 0,
      orders: o.orders,
      aov: round2(o.revenue / o.orders),
      customerSince: o.first,
      lastOrder: o.last,
      ...vipStatus(o.last, now),
      learners: e ? e.learners.size : 0,
      enrollments: e ? e.enrollments : 0,
      completionRate: e ? (pct(e.completed, e.enrollments) ?? 0) : null,
    };
  });
  const vipRevenue = round2(vips.reduce((s, v) => s + v.revenue, 0));
  const lowestVip = vips.length ? vips[vips.length - 1].revenue : null;

  return {
    period: { from: from || null, to: to || null, timezone: REPORT_TIMEZONE },
    rules: { ...VIP_RULES, TOP },
    totals: {
      revenue: totalRevenue,
      orders: totalOrders,
      payingOrganizations: periodOrders.length,
      enrollments: totalEnrollments,
      enrollingOrganizations: periodEnr.size,
      lifetimeRevenue,
      lifetimePaying: paying.length,
    },
    topRevenue,
    topRevenueSum,
    topRevenueShare: pct(topRevenueSum, totalRevenue) ?? 0,
    others: {
      revenue: { organizations: otherRevenue.length, revenue: round2(otherRevenue.reduce((s, r) => s + r.revenue, 0)), orders: otherRevenue.reduce((s, r) => s + r.orders, 0) },
      enrollment: { organizations: otherEnrollment.length, enrollments: otherEnrollment.reduce((s, r) => s + r.enrollments, 0) },
    },
    topEnrollment,
    topEnrollmentShare: pct(topEnrollment.reduce((s, r) => s + r.enrollments, 0), totalEnrollments) ?? 0,
    vip: {
      customers: vips,
      revenue: vipRevenue,
      share: pct(vipRevenue, lifetimeRevenue) ?? 0,
      threshold: lowestVip,
      atRisk: vips.filter(v => v.status === 'at_risk').length,
      cooling: vips.filter(v => v.status === 'cooling').length,
      active: vips.filter(v => v.status === 'active').length,
    },
    generatedAt: new Date(),
  };
}
