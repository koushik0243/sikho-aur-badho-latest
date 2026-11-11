import { money, dateLabel, todayYMD } from '../Components/SuperAdmin/Reports/reportFormat';
import { percentText } from '../Components/SuperAdmin/Reports/traineeData';
import { VIP_STATUS, vipRuleText } from '../Components/SuperAdmin/Reports/topOrganizationsData';
import { createReportPdf } from './reportPdf';

const rs = v => money(v, 'Rs.');
const STATUS_RGB = new Map(Object.values(VIP_STATUS).map(v => [v.label, v.rgb]));
const org = o => (o.location ? `${o.name} (${o.location})` : o.name);

/**
 * Downloads the Top Organizations report (the same data as the page) as an A4 PDF.
 * @param {object} report response of GET /report/top-organizations
 * @param {{ periodText: string }} opts
 */
export async function generateTopOrganizationsPDF(report, { periodText }) {
  const pdf = await createReportPdf({
    title: 'Top Organizations',
    subtitle: `${periodText}   |   by revenue and enrollments`,
    rightLines: [`Generated ${dateLabel(report.generatedAt || new Date())}`, 'VIP status is lifetime'],
  });
  const t = report.totals, vip = report.vip, oth = report.others, top = report.rules.TOP;

  pdf.tiles([
    ['Revenue', rs(t.revenue)],
    ['Paying organizations', `${t.payingOrganizations} (${t.orders} orders)`],
    ['Enrollments', String(t.enrollments)],
    ['VIP customers', `${vip.customers.length} (${vip.share}% rev.)`],
  ]);
  pdf.note('Revenue = successful credit purchases. Enrollment = one course assigned to one learner. The period filters both top-10 lists; VIP status is lifetime.');

  // ── Top 10 by revenue ─────────────────────────────────
  pdf.section(`Top ${top} by revenue`);
  pdf.table(
    [{ label: '#', width: 8 }, { label: 'Organization', width: 60, wrap: true }, { label: 'Orders', width: 16, align: 'right' }, { label: 'Revenue', width: 28, align: 'right' },
      { label: 'Share', width: 16, align: 'right' }, { label: 'Avg order', width: 26, align: 'right' }, { label: 'Last order' }],
    report.topRevenue.map(o => [String(o.rank), org(o), String(o.orders), rs(o.revenue), `${o.share}%`, rs(o.aov), dateLabel(o.lastOrder)]),
    'No orders in this period.',
  );
  if (report.topRevenue.length) {
    pdf.note(`The top ${report.topRevenue.length} brought in ${rs(report.topRevenueSum)} - ${report.topRevenueShare}% of ${rs(t.revenue)} in this period.${oth.revenue.organizations ? ` ${oth.revenue.organizations} other organizations: ${rs(oth.revenue.revenue)} from ${oth.revenue.orders} orders.` : ''}`);
  }

  // ── Top 10 by enrollment ──────────────────────────────
  pdf.section(`Top ${top} by enrollment`);
  pdf.table(
    [{ label: '#', width: 8 }, { label: 'Organization', width: 52, wrap: true }, { label: 'Enrolled', width: 18, align: 'right' }, { label: 'Share', width: 15, align: 'right' },
      { label: 'Learners', width: 18, align: 'right' }, { label: 'Courses', width: 17, align: 'right' }, { label: 'Done', width: 13, align: 'right' },
      { label: 'Dropout', width: 18, align: 'right' }, { label: 'Completion', align: 'right' }],
    report.topEnrollment.map(o => [String(o.rank), org(o), String(o.enrollments), `${o.share}%`, String(o.learners), String(o.courses), String(o.completed), String(o.dropout), `${o.completionRate}%`]),
    'No enrollments in this period.',
  );
  if (report.topEnrollment.length) {
    pdf.note(`The top ${report.topEnrollment.length} hold ${report.topEnrollmentShare}% of ${t.enrollments} enrollments in this period.${oth.enrollment.organizations ? ` ${oth.enrollment.organizations} other organizations: ${oth.enrollment.enrollments} enrollments.` : ''}`);
  }

  // ── VIP customers ─────────────────────────────────────
  pdf.section('VIP customers');
  if (vip.customers.length) pdf.note(`${vip.active} active, ${vip.cooling} cooling, ${vip.atRisk} at risk. ${vip.customers.length} VIP${vip.customers.length === 1 ? '' : 's'} of ${t.lifetimePaying} paying organizations bring ${rs(vip.revenue)} (${vip.share}% of lifetime revenue); the entry level is ${rs(vip.threshold)}.`);
  pdf.table(
    [{ label: '#', width: 7 }, { label: 'Organization', width: 38, wrap: true }, { label: 'Status', width: 16, color: v => STATUS_RGB.get(v) }, { label: 'Lifetime', width: 24, align: 'right' },
      { label: 'Share', width: 13, align: 'right' }, { label: 'Orders', width: 15, align: 'right' }, { label: 'Since', width: 22 }, { label: 'Last order', width: 23 },
      { label: 'Completion', align: 'right' }],
    vip.customers.map(o => [String(o.rank), org(o), VIP_STATUS[o.status].label, rs(o.revenue), `${o.share}%`, String(o.orders), dateLabel(o.customerSince), dateLabel(o.lastOrder),
      percentText(o.completionRate).replace('—', '-')]),
    'No organization has paid yet.',
  );
  pdf.note(vipRuleText(report.rules));

  pdf.save(`top-organizations_${report.period?.from || 'all-time'}_to_${report.period?.to || todayYMD()}.pdf`);
}
