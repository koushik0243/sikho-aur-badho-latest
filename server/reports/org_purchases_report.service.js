import mongoose from 'mongoose';
import { REPORT_TIMEZONE, dayKey } from './report.service.js';
import { dateRange, inRange } from './report_stats.js';

const { ObjectId } = mongoose.Types;
const oid = (v) => String(v || '');
const num = (v) => Number(v?.toString?.() ?? v) || 0; // Decimal128-safe
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Credits bought / used / remaining and invoices for my organization.
 * Credits work as on the Credits page: a credit pack adds its credit limit
 * (limit_to); each course assigned to a learner uses one credit.
 * @param {{ orgId: string, from?: string, to?: string }} filters the period applies to the lists; the balance is always as of today
 */
export async function getOrgPurchasesReport({ orgId, from, to }) {
  const db = mongoose.connection.db;
  const org = new ObjectId(orgId);
  const range = dateRange(from, to);

  const [orgDoc, packs, uses, orders, invoices, credits] = await Promise.all([
    db.collection('organizations').findOne({ _id: org }, { projection: { org_name: 1 } }),
    db.collection('organization_credit_assignments').find({ orgId: org, deletedAt: null }).sort({ createdAt: -1 }).toArray(),
    db.collection('credit_useds').find({ orgId: org, deletedAt: null, status: 'active' }).project({ learnerId: 1, courseId: 1, createdAt: 1 }).sort({ createdAt: -1 }).toArray(),
    db.collection('orders').find({ organizer_id: org, deletedAt: null }).sort({ purchase_date: -1 }).toArray(),
    db.collection('invoices').find({ org_id: org, deletedAt: null }).sort({ createdAt: -1 }).toArray(),
    db.collection('credits').find({}).project({ title: 1, limit_from: 1, limit_to: 1, price: 1 }).toArray(),
  ]);
  const pack = new Map(credits.map(c => [oid(c._id), c]));
  const userIds = [...new Set(uses.map(u => oid(u.learnerId)))].map(id => new ObjectId(id));
  const courseIds = [...new Set(uses.map(u => oid(u.courseId)).filter(Boolean))].map(id => new ObjectId(id));
  const [users, courses] = await Promise.all([
    db.collection('users').find({ _id: { $in: userIds } }).project({ name: 1, email: 1, deletedAt: 1 }).toArray(),
    db.collection('courses').find({ _id: { $in: courseIds } }).project({ title: 1, deletedAt: 1, status: 1 }).toArray(),
  ]);
  const userOf = new Map(users.map(u => [oid(u._id), u]));
  const courseTitle = new Map(courses.map(c => [oid(c._id), `${c.title || 'Untitled course'}${c.deletedAt || c.status === 'deleted' ? ' (deleted)' : ''}`]));
  const when = (d) => inRange(new Date(d), range);

  // ── Credit packs (bought) ─────────────────────────────
  const packRows = packs.map(p => {
    const c = pack.get(oid(p.creditId));
    return {
      id: oid(p._id), boughtAt: p.createdAt, package: c?.title || 'Deleted package',
      credits: c?.limit_to ?? 0, range: c ? `${c.limit_from}–${c.limit_to}` : null,
      price: round2(num(c?.price)), status: p.status || 'active', dueDate: p.dueDate || null,
    };
  });
  const boughtTotal = packRows.reduce((s, p) => s + p.credits, 0);
  const packsInPeriod = packRows.filter(p => when(p.boughtAt));

  // ── Credits used ──────────────────────────────────────
  const useRows = uses.map(u => {
    const person = userOf.get(oid(u.learnerId));
    return {
      usedAt: u.createdAt, learnerId: oid(u.learnerId),
      name: person ? `${person.name || person.email || 'Employee'}${person.deletedAt ? ' (removed)' : ''}` : 'Removed employee',
      email: person?.email || null,
      course: u.courseId ? (courseTitle.get(oid(u.courseId)) || 'Deleted course') : 'No course recorded',
    };
  });
  const usesInPeriod = useRows.filter(u => when(u.usedAt));
  const group = (list, key) => {
    const m = new Map();
    list.forEach(u => m.set(u[key], (m.get(u[key]) || 0) + 1));
    return [...m.entries()].map(([k, n]) => ({ [key]: k, credits: n })).sort((a, b) => b.credits - a.credits || String(a[key]).localeCompare(String(b[key])));
  };
  const byEmployee = (() => {
    const m = new Map();
    usesInPeriod.forEach(u => {
      const g = m.get(u.learnerId) || { name: u.name, email: u.email, credits: 0, courses: new Set() };
      g.credits += 1; g.courses.add(u.course);
      m.set(u.learnerId, g);
    });
    return [...m.values()].map(g => ({ name: g.name, email: g.email, credits: g.credits, courses: [...g.courses] })).sort((a, b) => b.credits - a.credits || a.name.localeCompare(b.name));
  })();

  // ── Monthly ───────────────────────────────────────────
  const months = new Map();
  const bump = (d, field, n) => {
    const k = dayKey(new Date(d)).slice(0, 7);
    const m = months.get(k) || { month: k, bought: 0, used: 0, spent: 0 };
    m[field] += n;
    months.set(k, m);
  };
  packsInPeriod.forEach(p => bump(p.boughtAt, 'bought', p.credits));
  usesInPeriod.forEach(u => bump(u.usedAt, 'used', 1));

  // ── Orders + invoices ─────────────────────────────────
  const invoiceOfOrder = new Map(invoices.map(i => [oid(i.order_id), i]));
  const orderById = new Map(orders.map(o => [oid(o._id), o]));
  const invoiceRows = invoices.filter(i => when(i.payment_date || i.createdAt)).map(i => {
    const o = orderById.get(oid(i.order_id));
    return {
      id: oid(i._id), invoiceNo: i.invoice_no || '—', date: i.payment_date || i.createdAt,
      package: o ? (pack.get(oid(o.credit_id))?.title || 'Deleted package') : '—',
      subTotal: round2(i.sub_total), discount: round2(i.discount), tax: round2(i.tax), total: round2(i.total_amount),
      currency: i.currency || 'INR', paymentStatus: i.payment_status || 'pending', paymentMethod: i.payment_method || null,
      transactionId: i.transaction_id || null,
    };
  });
  const orderRows = orders.filter(o => when(o.purchase_date || o.createdAt)).map(o => ({
    id: oid(o._id), date: o.purchase_date || o.createdAt, package: pack.get(oid(o.credit_id))?.title || 'Deleted package',
    credits: pack.get(oid(o.credit_id))?.limit_to ?? null, amount: round2(o.credit_amount), status: o.status || 'pending',
    gateway: o.payment_gateway || null, invoiceNo: invoiceOfOrder.get(oid(o._id))?.invoice_no || null,
  }));
  orderRows.filter(o => o.status === 'success').forEach(o => bump(o.date, 'spent', o.amount));
  const paid = orderRows.filter(o => o.status === 'success');

  return {
    period: { from: from || null, to: to || null, timezone: REPORT_TIMEZONE },
    organization: orgDoc?.org_name || 'My organization',
    balance: { bought: boughtTotal, used: useRows.length, remaining: boughtTotal - useRows.length, packs: packRows.length },
    totals: {
      creditsBought: packsInPeriod.reduce((s, p) => s + p.credits, 0),
      packsBought: packsInPeriod.length,
      creditsUsed: usesInPeriod.length,
      employeesUsing: byEmployee.length,
      amountPaid: round2(paid.reduce((s, o) => s + o.amount, 0)),
      orders: orderRows.length,
      paidOrders: paid.length,
      invoices: invoiceRows.length,
      invoiced: round2(invoiceRows.reduce((s, i) => s + i.total, 0)),
      ordersWithoutInvoice: paid.filter(o => !o.invoiceNo).length,
    },
    monthly: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).map(m => ({ ...m, spent: round2(m.spent) })),
    packs: packsInPeriod,
    usage: usesInPeriod,
    usageByCourse: group(usesInPeriod, 'course'),
    usageByEmployee: byEmployee,
    orders: orderRows,
    invoices: invoiceRows,
    generatedAt: new Date(),
  };
}
