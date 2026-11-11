import { money, moneyShort, dateLabel, todayYMD, revenueSeries } from '../Components/SuperAdmin/Reports/reportFormat';
import { createReportPdf } from './reportPdf';

const rs = v => money(v, 'Rs.');

/**
 * Downloads the Revenue report (revenue, AOV, course-wise revenue) as an A4 PDF.
 * @param {object} report response of GET /report/revenue
 * @param {{ periodText: string, view: 'monthly'|'daily' }} opts the period text and the view shown on the page
 */
export async function generateRevenuePDF(report, { periodText, view = 'monthly' }) {
  const daily = view === 'daily' && report.daily;
  const mode = daily ? 'Daily' : 'Monthly';
  const points = revenueSeries(report, daily ? 'daily' : 'monthly');
  const pdf = await createReportPdf({
    title: 'Revenue Report',
    subtitle: `${periodText}   |   ${mode}`,
    rightLines: [`Generated ${dateLabel(report.generatedAt || new Date())}`, 'Successful credit-package orders'],
  });
  const t = report.totals;
  pdf.tiles([
    ['Total revenue', rs(t.revenue)],
    ['Orders', String(t.orders)],
    ['Average order value', rs(t.averageOrder)],
  ]);

  // ── Revenue ─────────────────────────────────────────────
  const CHART = 72; // a heading stays on the same page as its chart
  pdf.section(`${mode} revenue`, CHART);
  if (points.length && t.orders) {
    pdf.columnChart(points.map(p => ({ shortLabel: p.shortLabel, value: p.revenue })), { formatAxis: v => moneyShort(v, 'Rs.') });
    const rows = (daily ? points.filter(p => p.orders > 0) : points);
    pdf.table(
      [{ label: daily ? 'Day' : 'Month', width: 72 }, { label: 'Orders', width: 30, align: 'right' }, { label: 'Revenue', width: 42, align: 'right' }, { label: 'AOV', align: 'right' }],
      rows.map(p => [p.label, String(p.orders), rs(p.revenue), p.orders ? rs(p.aov) : '-']),
      'No orders in this period.',
    );
    if (daily) pdf.tableNote('Days without orders are left out of the table.');
  } else {
    pdf.empty('No orders in this period.');
  }

  // ── AOV ───────────────────────────────────────────────
  pdf.section('Average order value (AOV)', CHART + 12);
  pdf.note(`${rs(t.averageOrder)} overall  =  ${rs(t.revenue)} / ${t.orders} order${t.orders === 1 ? '' : 's'}   |   per ${daily ? 'day' : 'month'} below`);
  if (points.length && t.orders) {
    pdf.columnChart(points.map(p => ({ shortLabel: p.shortLabel, value: p.aov })), { formatAxis: v => moneyShort(v, 'Rs.') });
  } else {
    pdf.empty('No orders in this period.');
  }

  // ── Course-wise revenue ───────────────────────────────
  pdf.section('Course-wise revenue');
  const c = report.byCourse || { rows: [], unallocated: 0, creditsUsed: 0 };
  const share = v => (t.revenue ? `${Math.round((v / t.revenue) * 1000) / 10}%` : '0%');
  const rows = c.rows.map(r => [r.title, String(r.credits), String(r.organizations), rs(r.revenue), share(r.revenue)]);
  if (c.unallocated > 0) rows.push(['Not yet used on a course', '-', '-', rs(c.unallocated), share(c.unallocated)]);
  if (rows.length) rows.push(['Total', String(c.creditsUsed), '', rs(t.revenue), '']);
  pdf.table(
    [{ label: 'Course', width: 76 }, { label: 'Credits used', width: 26, align: 'right' }, { label: 'Organizations', width: 28, align: 'right' }, { label: 'Revenue', width: 30, align: 'right' }, { label: 'Share', align: 'right' }],
    rows,
    'No revenue in this period.',
  );
  pdf.note('Organizations buy credits, not courses - each credit assigns one course to one learner. An organization\'s revenue is shared across the courses it used credits on in the period; revenue from organizations that have not used credits yet is "Not yet used on a course".');

  pdf.save(`revenue-report_${report.period?.from || 'all-time'}_to_${report.period?.to || todayYMD()}_${daily ? 'daily' : 'monthly'}.pdf`);
}
