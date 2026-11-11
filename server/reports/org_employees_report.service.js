import mongoose from 'mongoose';
import { REPORT_TIMEZONE, startOfDayIST } from './report.service.js';
import { dateRange } from './report_stats.js';
import { loadEnrollments, DROPOUT_DAYS } from './trainee_report.service.js';

const { ObjectId } = mongoose.Types;
const DAY_MS = 24 * 60 * 60 * 1000;

// Alert rules for an organization's employees.
export const EMPLOYEE_RULES = {
  ACTIVE_DAYS: DROPOUT_DAYS,  // active = signed in or learned within this many days
  LONG_INACTIVE_DAYS: 60,     // critical when inactive this long with courses pending
  NOT_STARTED_DAYS: 7,        // a course assigned this long ago and never opened
};

const oid = (v) => String(v || '');
const latest = (...dates) => dates.filter(Boolean).map(d => new Date(d)).reduce((a, b) => (!a || b > a ? b : a), null);
const daysSince = (date, now) => (date ? Math.floor((now - new Date(date).getTime()) / DAY_MS) : null);
const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 };

/** Why an employee needs attention (empty when all is well). */
function employeeAlerts(e, now) {
  const alerts = [];
  const pending = e.inProgress + e.notStarted + e.dropout;
  const idle = daysSince(e.lastActive, now);
  if (e.dropout > 0) alerts.push({ severity: 'critical', text: `Stopped ${e.dropout} course${e.dropout === 1 ? '' : 's'} (no learning for ${EMPLOYEE_RULES.ACTIVE_DAYS}+ days)` });
  if (pending > 0 && idle !== null && idle >= EMPLOYEE_RULES.LONG_INACTIVE_DAYS) alerts.push({ severity: 'critical', text: `Inactive for ${idle} days with ${pending} course${pending === 1 ? '' : 's'} pending` });
  else if (pending > 0 && idle !== null && idle >= EMPLOYEE_RULES.ACTIVE_DAYS) alerts.push({ severity: 'warning', text: `Inactive for ${idle} days with ${pending} course${pending === 1 ? '' : 's'} pending` });
  if (e.enrolled > 0 && !e.lastLoginAt && !e.lastActive) alerts.push({ severity: 'warning', text: 'Has courses but no sign-in or learning recorded' });
  const stale = e.notStartedStale;
  if (stale > 0) alerts.push({ severity: 'warning', text: `${stale} course${stale === 1 ? '' : 's'} assigned ${EMPLOYEE_RULES.NOT_STARTED_DAYS}+ days ago, not started` });
  if (e.accountStatus !== 'active' && pending > 0) alerts.push({ severity: 'info', text: `Account is ${e.accountStatus} but ${pending} course${pending === 1 ? ' is' : 's are'} pending` });
  if (e.enrolled === 0 && e.accountStatus === 'active') alerts.push({ severity: 'info', text: 'No course assigned yet' });
  return alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/**
 * My organization's employees: enrolled courses, status, last login,
 * active / inactive, alerts, completed, pending and certificates.
 * @param {{ orgId: string, from?: string, to?: string }} filters the period applies to enrollments (assigned date) and certificates (issued date)
 */
export async function getOrgEmployeesReport({ orgId, from, to }) {
  const db = mongoose.connection.db;
  const now = Date.now();
  const org = new ObjectId(orgId);
  const range = dateRange(from, to);

  const [orgDoc, employees, enrollment] = await Promise.all([
    db.collection('organizations').findOne({ _id: org }, { projection: { org_name: 1 } }),
    db.collection('users').find({ orgId: org, user_type: 'employee', deletedAt: null })
      .project({ name: 1, email: 1, emp_id: 1, department: 1, designation: 1, status: 1, createdAt: 1, lastLoginAt: 1 }).sort({ name: 1 }).toArray(),
    loadEnrollments({ from, to, orgId }),
  ]);
  const ids = employees.map(u => u._id);
  const idSet = new Set(ids.map(oid));
  const since = new Date(now - EMPLOYEE_RULES.LONG_INACTIVE_DAYS * 4 * DAY_MS); // learning look-back for "last active"
  const [trackedDays, certificates, events, firstTracked] = await Promise.all([
    db.collection('user_active_days').aggregate([
      { $match: { userId: { $in: ids } } },
      { $group: { _id: '$userId', day: { $max: '$day' } } },
    ]).toArray(),
    db.collection('course_completions').find({ userId: { $in: ids }, ...(range ? { completedAt: range } : {}) })
      .project({ userId: 1, courseId: 1, completedAt: 1 }).sort({ completedAt: -1 }).toArray(),
    Promise.all([
      db.collection('progresses').aggregate([{ $match: { userId: { $in: ids }, updatedAt: { $gte: since } } }, { $group: { _id: '$userId', at: { $max: '$updatedAt' } } }]).toArray(),
      db.collection('quiz_attempts').aggregate([{ $match: { userId: { $in: ids }, createdAt: { $gte: since } } }, { $group: { _id: '$userId', at: { $max: '$createdAt' } } }]).toArray(),
      db.collection('aptitude_attempts').aggregate([{ $match: { userId: { $in: ids }, createdAt: { $gte: since } } }, { $group: { _id: '$userId', at: { $max: '$createdAt' } } }]).toArray(),
    ]),
    db.collection('user_active_days').find().sort({ day: 1 }).limit(1).project({ day: 1 }).toArray(),
  ]);
  const trackedAt = new Map(trackedDays.map(t => [oid(t._id), startOfDayIST(t.day)]));
  const learnedAt = new Map();
  events.flat().forEach(e => { learnedAt.set(oid(e._id), latest(learnedAt.get(oid(e._id)), e.at)); });

  // Course titles (certificates may be for courses deleted since).
  const courseIds = [...new Set([...certificates.map(c => oid(c.courseId)), ...enrollment.rows.map(r => r.courseId)])].map(id => new ObjectId(id));
  const courseDocs = await db.collection('courses').find({ _id: { $in: courseIds } }).project({ title: 1, deletedAt: 1, status: 1 }).toArray();
  const courseTitle = new Map(courseDocs.map(c => [oid(c._id), `${c.title || 'Untitled course'}${c.deletedAt || c.status === 'deleted' ? ' (deleted)' : ''}`]));
  const certified = new Set(certificates.map(c => `${c.userId}|${c.courseId}`));

  // ── Enrolled list ─────────────────────────────────────
  const rows = enrollment.rows.filter(r => idSet.has(r.learnerId));
  const enrollments = rows.map(r => ({
    learnerId: r.learnerId, name: r.name, email: r.email,
    courseId: r.courseId, course: courseTitle.get(r.courseId) || r.course,
    enrolledAt: r.enrolledAt, progress: r.progress, status: r.status,
    lastActivity: r.lastActivity, completedAt: r.completedAt,
    certificate: certified.has(`${r.learnerId}|${r.courseId}`),
  })).sort((a, b) => a.name.localeCompare(b.name) || new Date(b.enrolledAt) - new Date(a.enrolledAt));

  // ── Employees ─────────────────────────────────────────
  const certCount = new Map();
  certificates.forEach(c => certCount.set(oid(c.userId), (certCount.get(oid(c.userId)) || 0) + 1));
  const people = employees.map(u => {
    const id = oid(u._id);
    const mine = rows.filter(r => r.learnerId === id);
    const count = st => mine.filter(r => r.status === st).length;
    const lastActive = latest(trackedAt.get(id), learnedAt.get(id), ...mine.map(r => r.lastActivity), u.lastLoginAt);
    const e = {
      learnerId: id,
      name: u.name || u.email || 'Employee',
      email: u.email || null,
      empId: u.emp_id || null,
      department: u.department || null,
      designation: u.designation || null,
      accountStatus: u.status || 'active',
      joinedAt: u.createdAt || null,
      lastLoginAt: u.lastLoginAt || null,
      lastActive,
      activity: lastActive && daysSince(lastActive, now) < EMPLOYEE_RULES.ACTIVE_DAYS ? 'active' : 'inactive',
      enrolled: mine.length,
      completed: count('completed'),
      inProgress: count('in_progress'),
      notStarted: count('not_started'),
      dropout: count('dropout'),
      notStartedStale: mine.filter(r => r.status !== 'completed' && !r.lastActivity && daysSince(r.enrolledAt, now) >= EMPLOYEE_RULES.NOT_STARTED_DAYS && r.status !== 'dropout').length,
      certificates: certCount.get(id) || 0,
    };
    e.pending = e.inProgress + e.notStarted + e.dropout;
    e.alerts = employeeAlerts(e, now);
    delete e.notStartedStale;
    return e;
  });

  const alertList = people.flatMap(p => p.alerts.map(a => ({ learnerId: p.learnerId, name: p.name, email: p.email, ...a })))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.name.localeCompare(b.name));
  const sum = f => people.reduce((s, p) => s + p[f], 0);

  return {
    period: { from: from || null, to: to || null, timezone: REPORT_TIMEZONE },
    organization: orgDoc?.org_name || 'My organization',
    rules: EMPLOYEE_RULES,
    loginTrackingSince: firstTracked[0]?.day || null, // sign-ins are recorded from this day
    totals: {
      employees: people.length,
      active: people.filter(p => p.activity === 'active').length,
      inactive: people.filter(p => p.activity === 'inactive').length,
      accountActive: people.filter(p => p.accountStatus === 'active').length,
      accountInactive: people.filter(p => p.accountStatus !== 'active').length,
      enrolledEmployees: people.filter(p => p.enrolled > 0).length,
      enrollments: rows.length,
      completed: sum('completed'),
      pending: sum('pending'),
      inProgress: sum('inProgress'),
      notStarted: sum('notStarted'),
      dropout: sum('dropout'),
      certificates: certificates.length,
      alerts: alertList.length,
      criticalAlerts: alertList.filter(a => a.severity === 'critical').length,
      noLoginRecorded: people.filter(p => !p.lastLoginAt).length,
    },
    employees: people,
    enrollments,
    alerts: alertList,
    certificates: certificates.map(c => {
      const p = people.find(x => x.learnerId === oid(c.userId));
      return { name: p?.name || 'Employee', email: p?.email || null, course: courseTitle.get(oid(c.courseId)) || 'Deleted course', issuedAt: c.completedAt };
    }),
    generatedAt: new Date(),
  };
}
