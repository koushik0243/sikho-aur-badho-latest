import { money, monthLabel, dateLabel, todayYMD } from '../Components/SuperAdmin/Reports/reportFormat';
import { ORDER_STATUS, PAYMENT_STATUS, methodLabel, RULES_TEXT } from '../Components/StoreOwner/Reports/purchasesData';
import { createReportPdf } from './reportPdf';

const rs = v => money(v, 'Rs.');
const TEAL = [13, 148, 136], GRAY = [156, 163, 175];
const STATUS_RGB = { Paid: [21, 128, 61], Pending: [180, 83, 9], Failed: [185, 28, 28] };
const dash = v => (v === '—' ? '-' : v);

/**
 * Downloads the Purchases report (the same data as the page) as an A4 PDF.
 * @param {object} report response of GET /org-report/purchases
 * @param {{ periodText: string }} opts
 */
export async function generatePurchasesPDF(report, { periodText }) {
  const pdf = await createReportPdf({
    title: 'Purchases',
    subtitle: `${report.organization}   |   ${periodText}`,
    rightLines: [`Generated ${dateLabel(report.generatedAt || new Date())}`, '1 credit = 1 course assigned'],
  });
  const b = report.balance, t = report.totals;

  pdf.tiles([
    ['Credits remaining', `${b.remaining} of ${b.bought}`],
    ['Credits bought', `${t.creditsBought} (${t.packsBought} packs)`],
    ['Credits used', String(t.creditsUsed)],
    ['Amount paid', rs(t.amountPaid)],
  ]);
  pdf.note(`Remaining is the balance today (all credits bought - all used). Bought, used, paid and the lists are for ${periodText === 'All time' ? 'all time' : periodText}.`);

  pdf.section('Credit balance (today)', 30);
  pdf.splitBar([{ label: 'Used', value: b.used, rgb: TEAL }, { label: 'Remaining', value: Math.max(0, b.remaining), rgb: GRAY }]);

  pdf.section('By month');
  pdf.table(
    [{ label: 'Month', width: 60 }, { label: 'Credits bought', width: 40, align: 'right' }, { label: 'Credits used', width: 40, align: 'right' }, { label: 'Paid', align: 'right' }],
    report.monthly.map(m => [monthLabel(m.month), String(m.bought), String(m.used), rs(m.spent)]),
    'No purchases or usage in this period.',
  );

  pdf.section('Credits bought');
  pdf.table(
    [{ label: 'Date', width: 30 }, { label: 'Package', width: 52 }, { label: 'Credits', width: 22, align: 'right' }, { label: 'Price', width: 30, align: 'right' }, { label: 'Due date', width: 28 }, { label: 'Status' }],
    report.packs.map(p => [dateLabel(p.boughtAt), p.package, String(p.credits), rs(p.price), p.dueDate ? dateLabel(p.dueDate) : '-', p.status === 'active' ? 'Active' : 'Inactive']),
    'No credit packs bought in this period.',
  );

  pdf.section('Credits used by course');
  pdf.table(
    [{ label: 'Course', width: 120, wrap: true }, { label: 'Credits', width: 30, align: 'right' }, { label: 'Share', align: 'right' }],
    report.usageByCourse.map(r => [r.course, String(r.credits), t.creditsUsed ? `${Math.round((r.credits / t.creditsUsed) * 1000) / 10}%` : '-']),
    'No credits used in this period.',
  );

  pdf.section('Credits used by employee');
  pdf.table(
    [{ label: 'Employee', width: 60, wrap: true }, { label: 'Credits', width: 22, align: 'right' }, { label: 'Courses', wrap: true }],
    report.usageByEmployee.map(r => [r.email ? `${r.name} (${r.email})` : r.name, String(r.credits), r.courses.join(', ')]),
    'No credits used in this period.',
  );

  pdf.section('Credit usage');
  pdf.table(
    [{ label: 'Date', width: 30 }, { label: 'Employee', width: 56, wrap: true }, { label: 'Course', wrap: true }],
    report.usage.map(u => [dateLabel(u.usedAt), u.name, u.course]),
    'No credits used in this period.',
  );

  pdf.section('Invoices');
  pdf.table(
    [{ label: 'Invoice', width: 44, wrap: true }, { label: 'Date', width: 24 }, { label: 'Package', width: 22 }, { label: 'Subtotal', width: 22, align: 'right' },
      { label: 'Tax', width: 16, align: 'right' }, { label: 'Total', width: 22, align: 'right' }, { label: 'Method', width: 16 }, { label: 'Status', color: v => STATUS_RGB[v] }],
    report.invoices.map(i => [i.invoiceNo, dateLabel(i.date), i.package, rs(i.subTotal), i.tax ? rs(i.tax) : '-', rs(i.total), dash(methodLabel(i.paymentMethod)), PAYMENT_STATUS[i.paymentStatus] || i.paymentStatus]),
    'No invoices in this period.',
  );
  const missing = report.orders.filter(o => o.status === 'success' && !o.invoiceNo);
  if (missing.length) pdf.note(`${missing.length} paid order${missing.length === 1 ? ' has' : 's have'} no invoice: ${missing.map(o => `${o.package}, ${rs(o.amount)} on ${dateLabel(o.date)}`).join('; ')}.`);

  pdf.section('Orders');
  pdf.table(
    [{ label: 'Date', width: 26 }, { label: 'Package', width: 26 }, { label: 'Credits', width: 18, align: 'right' }, { label: 'Amount', width: 26, align: 'right' },
      { label: 'Payment', width: 20 }, { label: 'Status', width: 20, color: v => STATUS_RGB[v] }, { label: 'Invoice', wrap: true }],
    report.orders.map(o => [dateLabel(o.date), o.package, o.credits === null ? '-' : String(o.credits), rs(o.amount), dash(methodLabel(o.gateway)), ORDER_STATUS[o.status] || o.status, o.invoiceNo || 'No invoice']),
    'No orders in this period.',
  );

  pdf.section('How credits are counted', 24);
  pdf.note(RULES_TEXT.map(x => `- ${x}`).join('\n'));

  pdf.save(`purchases_${report.period?.from || 'all-time'}_to_${report.period?.to || todayYMD()}.pdf`);
}
