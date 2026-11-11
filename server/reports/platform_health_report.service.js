import mongoose from 'mongoose';
import { REPORT_TIMEZONE, startOfDayIST, dayKey, courseWiseRevenue } from './report.service.js';
import { pct, avg, dateRange } from './report_stats.js';
import { loadEnrollments } from './trainee_report.service.js';

const { ObjectId } = mongoose.Types;
export const DAU_DAYS = 30;
const LATEST_CERTIFICATES = 10;

const oid = (v) => String(v || '');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const change = (now, before) => (before ? Math.round(((now - before) / before) * 1000) / 10 : null);
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const nextDay = (key) => { const d = startOfDayIST(key); d.setUTCDate(d.getUTCDate() + 1); return d; };

/** The last `n` day keys ending today (India time), oldest first. */
function lastDays(n, today) {
  const out = [];
  const d = new Date(`${today}T00:00:00Z`);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

// ── DAU ─────────────────────────────────────────────────
/**
 * Active users per day for the last DAU_DAYS days: signed-in days recorded by
 * the auth middleware, plus days with learning activity (which also fills the
 * days before tracking started).
 */
async function dailyActiveUsers(db, today) {
  const days = lastDays(DAU_DAYS, today);
  const since = startOfDayIST(days[0]);
  const at = { $gte: since };
  const [tracked, firstTracked, ...events] = await Promise.all([
    db.collection('user_active_days').find({ day: { $gte: days[0] } }).project({ userId: 1, day: 1 }).toArray(),
    db.collection('user_active_days').find().sort({ day: 1 }).limit(1).project({ day: 1 }).toArray(),
    db.collection('quiz_attempts').find({ createdAt: at }).project({ userId: 1, createdAt: 1 }).toArray(),
    db.collection('aptitude_attempts').find({ createdAt: at }).project({ userId: 1, createdAt: 1 }).toArray(),
    db.collection('progresses').find({ updatedAt: at }).project({ userId: 1, updatedAt: 1 }).toArray(),
    db.collection('notes').find({ createdAt: at }).project({ userId: 1, createdAt: 1 }).toArray(),
    db.collection('reviews').find({ createdAt: at }).project({ userId: 1, createdAt: 1 }).toArray(),
    db.collection('topic_activities').find({ createdAt: at }).project({ userId: 1, createdAt: 1 }).toArray(),
    db.collection('course_completions').find({ completedAt: at }).project({ userId: 1, completedAt: 1 }).toArray(),
  ]);
  const byDay = new Map(days.map(d => [d, new Set()]));
  tracked.forEach(t => byDay.get(t.day)?.add(oid(t.userId)));
  for (const list of events) {
    for (const e of list) {
      const when = e.createdAt || e.updatedAt || e.completedAt;
      if (when) byDay.get(dayKey(new Date(when)))?.add(oid(e.userId));
    }
  }

  const everyone = new Set([...byDay.values()].flatMap(s => [...s]));
  const users = await db.collection('users').find({ _id: { $in: [...everyone].filter(id => mongoose.isValidObjectId(id)).map(id => new ObjectId(id)) } })
    .project({ user_type: 1, orgId: 1 }).toArray();
  const userInfo = new Map(users.map(u => [oid(u._id), u]));
  const isLearner = id => userInfo.get(id)?.user_type === 'employee';

  const daily = days.map(day => {
    const set = byDay.get(day);
    const learners = [...set].filter(isLearner).length;
    return { day, active: set.size, learners, others: set.size - learners };
  });
  const avgDau = avg(daily.map(d => d.active)) ?? 0;
  const peak = daily.reduce((best, d) => (d.active > best.active ? d : best), daily[0]);
  return {
    days: DAU_DAYS,
    daily,
    today: daily[daily.length - 1],
    yesterday: daily[daily.length - 2],
    avgDau,
    mau: everyone.size,
    mauLearners: [...everyone].filter(isLearner).length,
    stickiness: pct(avgDau, everyone.size),
    peak: peak.active ? peak : null,
    trackingSince: firstTracked[0]?.day || null,
    activeUserIds: everyone,
    userInfo,
  };
}

// ── MTD / YTD revenue ───────────────────────────────────
async function revenueToDate(db, today) {
  const [y, m, d] = today.split('-').map(Number);
  const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;
  const spans = {
    mtd: [ymd(y, m, 1), today],
    lastMonthToDate: [ymd(py, pm, 1), ymd(py, pm, Math.min(d, daysInMonth(py, pm)))],
    lastMonth: [ymd(py, pm, 1), ymd(py, pm, daysInMonth(py, pm))],
    ytd: [ymd(y, 1, 1), today],
    lastYearToDate: [ymd(y - 1, 1, 1), ymd(y - 1, m, Math.min(d, daysInMonth(y - 1, m)))],
  };
  const facets = Object.fromEntries(Object.entries(spans).map(([k, [from, to]]) => [k, [
    { $match: { purchase_date: { $gte: startOfDayIST(from), $lt: nextDay(to) } } },
    { $group: { _id: null, revenue: { $sum: '$credit_amount' }, orders: { $sum: 1 }, orgs: { $addToSet: '$organizer_id' } } },
  ]]));
  const [res] = await db.collection('orders').aggregate([{ $match: { deletedAt: null, status: 'success' } }, { $facet: facets }]).toArray();
  const out = {};
  for (const [k, [from, to]] of Object.entries(spans)) {
    const r = res[k][0];
    out[k] = { from, to, revenue: round2(r?.revenue), orders: r?.orders || 0, organizations: r?.orgs?.length || 0 };
  }
  out.mtd.change = change(out.mtd.revenue, out.lastMonthToDate.revenue);
  out.ytd.change = change(out.ytd.revenue, out.lastYearToDate.revenue);
  return out;
}

const monthKeyOf = (date) => dayKey(new Date(date)).slice(0, 7);

/** 'YYYY-MM' keys from first to last, inclusive. */
function monthsBetween(first, last) {
  const out = [];
  let [y, m] = first.split('-').map(Number);
  const [ly, lm] = last.split('-').map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    out.push(ymd(y, m, 1).slice(0, 7));
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/** Certificates per month across the period (empty months included). */
function certMonths(byMonth, from, to, today) {
  const keys = [...byMonth.keys()].sort();
  const first = from ? from.slice(0, 7) : keys[0];
  const last = (to || today).slice(0, 7);
  if (!first || first > last) return [];
  return monthsBetween(first, last).map(month => ({ month, issued: byMonth.get(month) || 0 }));
}

/**
 * Platform health: DAU (last 30 days), MTD / YTD revenue (as of today),
 * certificates issued, course ranking and organization ranking (in the period).
 * @param {{ from?: string, to?: string }} filters 'YYYY-MM-DD', inclusive (India time)
 */
export async function getPlatformHealthReport({ from, to } = {}) {
  const db = mongoose.connection.db;
  const range = dateRange(from, to);
  const today = dayKey(new Date());

  const [dau, revenue, enrollment, certificates, attempts, reviews, periodOrders, courses, orgs, learnerCounts] = await Promise.all([
    dailyActiveUsers(db, today),
    revenueToDate(db, today),
    loadEnrollments({ from, to }),
    db.collection('course_completions').find(range ? { completedAt: range } : {}).project({ userId: 1, courseId: 1, completedAt: 1 }).sort({ completedAt: -1 }).toArray(),
    db.collection('quiz_attempts').find({ status: { $ne: 'pending' }, ...(range ? { createdAt: range } : {}) }).project({ userId: 1, courseId: 1, topicId: 1, passed: 1 }).toArray(),
    db.collection('reviews').find(range ? { createdAt: range } : {}).project({ courseId: 1, rating: 1 }).toArray(),
    db.collection('orders').aggregate([
      { $match: { deletedAt: null, status: 'success', ...(range ? { purchase_date: range } : {}) } },
      { $group: { _id: '$organizer_id', revenue: { $sum: '$credit_amount' }, orders: { $sum: 1 } } },
    ]).toArray(),
    db.collection('courses').find({ deletedAt: null, status: { $ne: 'deleted' } }).project({ title: 1, status: 1 }).toArray(),
    db.collection('organizations').find({ deletedAt: null }).project({ org_name: 1, org_city: 1, org_state: 1, status: 1 }).toArray(),
    db.collection('users').aggregate([
      { $match: { user_type: 'employee', deletedAt: null, orgId: { $ne: null } } },
      { $group: { _id: '$orgId', learners: { $sum: 1 } } },
    ]).toArray(),
  ]);

  // Names for learners on certificates.
  const certUsers = await db.collection('users').find({ _id: { $in: [...new Set(certificates.map(c => oid(c.userId)))].map(id => new ObjectId(id)) } })
    .project({ name: 1, email: 1, orgId: 1 }).toArray();
  const certUser = new Map(certUsers.map(u => [oid(u._id), u]));
  // Certificates stay valid when a course is deleted later, so name those courses too.
  const certCourses = await db.collection('courses').find({ _id: { $in: [...new Set(certificates.map(c => oid(c.courseId)))].map(id => new ObjectId(id)) } })
    .project({ title: 1, status: 1, deletedAt: 1 }).toArray();
  const certCourseTitle = new Map(certCourses.map(c => [oid(c._id), `${c.title || 'Untitled course'}${c.deletedAt || c.status === 'deleted' ? ' (deleted)' : ''}`]));
  const courseTitle = new Map(courses.map(c => [oid(c._id), c.title || 'Untitled course']));
  const orgName = new Map(orgs.map(o => [oid(o._id), o.org_name || 'Unnamed organization']));

  // ── Certificates ──────────────────────────────────────
  const certMonthly = new Map();
  certificates.forEach(c => { const k = monthKeyOf(c.completedAt); certMonthly.set(k, (certMonthly.get(k) || 0) + 1); });
  const certTotal = await db.collection('course_completions').countDocuments();

  // ── Course ranking ────────────────────────────────────
  const orgRevenue = new Map(periodOrders.map(o => [oid(o._id), o.revenue]));
  const byCourseRevenue = await courseWiseRevenue(orgRevenue, range);
  const courseRevenue = new Map(byCourseRevenue.rows.filter(r => r.courseId).map(r => [r.courseId, r.revenue]));
  const courseStats = new Map(courses.map(c => [oid(c._id), { enrollments: 0, learners: new Set(), completed: 0, certificates: 0, quiz: new Map(), ratings: [] }]));
  enrollment.rows.forEach(r => {
    const c = courseStats.get(r.courseId);
    if (!c) return;
    c.enrollments += 1;
    c.learners.add(r.learnerId);
    if (r.status === 'completed') c.completed += 1;
  });
  certificates.forEach(x => { const c = courseStats.get(oid(x.courseId)); if (c) c.certificates += 1; });
  attempts.forEach(a => {
    const c = courseStats.get(oid(a.courseId));
    if (!c) return;
    const k = `${a.userId}|${a.topicId}`;
    c.quiz.set(k, c.quiz.get(k) || Boolean(a.passed));
  });
  reviews.forEach(r => { const c = courseStats.get(oid(r.courseId)); if (c) c.ratings.push(Number(r.rating) || 0); });
  const courseRanking = [...courseStats.entries()].map(([id, c]) => ({
    courseId: id,
    title: courseTitle.get(id),
    status: courses.find(x => oid(x._id) === id)?.status || null,
    enrollments: c.enrollments,
    learners: c.learners.size,
    completed: c.completed,
    completionRate: pct(c.completed, c.enrollments),
    certificates: c.certificates,
    passRate: pct([...c.quiz.values()].filter(Boolean).length, c.quiz.size),
    rating: c.ratings.length ? avg(c.ratings) : null,
    reviews: c.ratings.length,
    revenue: courseRevenue.get(id) || 0,
  }));

  // ── Organization ranking ──────────────────────────────
  const learnersByOrg = new Map(learnerCounts.map(l => [oid(l._id), l.learners]));
  const activeByOrg = new Map();
  dau.activeUserIds.forEach(id => {
    const u = dau.userInfo.get(id);
    if (u?.user_type === 'employee' && u.orgId) activeByOrg.set(oid(u.orgId), (activeByOrg.get(oid(u.orgId)) || 0) + 1);
  });
  const orgEnroll = new Map();
  enrollment.rows.forEach(r => {
    if (!r.orgId) return;
    const g = orgEnroll.get(r.orgId) || { enrollments: 0, completed: 0 };
    g.enrollments += 1;
    if (r.status === 'completed') g.completed += 1;
    orgEnroll.set(r.orgId, g);
  });
  const orgCerts = new Map();
  certificates.forEach(c => { const o = oid(certUser.get(oid(c.userId))?.orgId); if (o) orgCerts.set(o, (orgCerts.get(o) || 0) + 1); });
  const orgRanking = orgs.map(o => {
    const id = oid(o._id);
    const e = orgEnroll.get(id) || { enrollments: 0, completed: 0 };
    const learners = learnersByOrg.get(id) || 0;
    const active = activeByOrg.get(id) || 0;
    return {
      orgId: id,
      name: orgName.get(id),
      location: [o.org_city, o.org_state].map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean).join(', ') || null,
      status: o.status || 'active',
      learners,
      activeLearners: active,
      activeRate: pct(active, learners),
      enrollments: e.enrollments,
      completionRate: pct(e.completed, e.enrollments),
      certificates: orgCerts.get(id) || 0,
      revenue: round2(orgRevenue.get(id)),
      orders: periodOrders.find(x => oid(x._id) === id)?.orders || 0,
    };
  });

  const { activeUserIds, userInfo, ...dauOut } = dau;
  return {
    period: { from: from || null, to: to || null, timezone: REPORT_TIMEZONE },
    today,
    dau: dauOut,
    revenue,
    certificates: {
      issued: certificates.length,
      total: certTotal,
      learners: new Set(certificates.map(c => oid(c.userId))).size,
      monthly: certMonths(certMonthly, from, to, today),
      latest: certificates.slice(0, LATEST_CERTIFICATES).map(c => {
        const u = certUser.get(oid(c.userId));
        return { name: u?.name || u?.email || 'Learner', organization: orgName.get(oid(u?.orgId)) || '—', course: certCourseTitle.get(oid(c.courseId)) || 'Deleted course', issuedAt: c.completedAt };
      }),
    },
    courseRanking,
    orgRanking,
    totals: {
      courses: courses.length,
      organizations: orgs.length,
      enrollments: enrollment.rows.length,
      periodRevenue: round2(periodOrders.reduce((s, o) => s + o.revenue, 0)),
    },
    generatedAt: new Date(),
  };
}
