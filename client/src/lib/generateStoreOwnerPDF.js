import { money, monthLabel, dateLabel, todayYMD } from '../Components/SuperAdmin/Reports/reportFormat';
import { RANKINGS, TOP_N, ORG_STATUS_LABEL, locationOf, topOrganizations } from '../Components/SuperAdmin/Reports/storeOwnerData';
import { createReportPdf } from './reportPdf';

const rs = v => money(v, 'Rs.');

/**
 * Downloads the Store Owner report (the same data as the page) as an A4 PDF.
 * @param {object} report response of GET /report/store-owners
 * @param {{ periodText: string, rankBy: string }} opts registration period text + Top 10 ranking
 */
export async function generateStoreOwnerPDF(report, { periodText, rankBy }) {
  const rankLabel = RANKINGS.find(r => r.value === rankBy)?.label || 'Revenue';
  const pdf = await createReportPdf({
    title: 'Store Owner Report',
    subtitle: `Organizations registered   |   ${periodText}`,
    rightLines: [`Generated ${dateLabel(report.generatedAt || new Date())}`, `Top ${TOP_N} ranked by ${rankLabel.toLowerCase()}`],
  });
  const t = report.totals;
  pdf.tiles([
    ['Registered', String(t.registered)],
    ['Active', String(t.active)],
    ['Inactive', String(t.inactive)],
    ['Suspended', String(t.suspended)],
  ]);
  pdf.note(`Registered this month ${t.registeredThisMonth}   |   Learners across these organizations ${t.learners}   |   Without a location ${t.withoutLocation}`);

  pdf.section('New registrations per month', 72);
  const months = report.monthly || [];
  if (months.length) {
    pdf.columnChart(months.map(m => ({ shortLabel: monthLabel(m.month, true), value: m.registered })), { formatAxis: v => String(Math.round(v)), integer: true });
  } else {
    pdf.empty('No organizations registered in this period.');
  }

  pdf.section(`Top ${TOP_N} companies by ${rankLabel.toLowerCase()}`);
  pdf.table(
    [{ label: '#', width: 8 }, { label: 'Company', width: 48 }, { label: 'Location', width: 36 }, { label: 'Learners', width: 18, align: 'right' },
      { label: 'Courses', width: 17, align: 'right' }, { label: 'Orders', width: 15, align: 'right' }, { label: 'Revenue', width: 24, align: 'right' }, { label: 'Status' }],
    topOrganizations(report.organizations || [], rankBy).map((o, i) => [
      String(i + 1), o.name, locationOf(o), String(o.learners), String(o.courses), String(o.orders), rs(o.revenue), ORG_STATUS_LABEL[o.status] || o.status,
    ]),
    'No organizations registered in this period.',
  );

  pdf.section('Location - by state');
  pdf.table(
    [{ label: 'State', width: 80 }, { label: 'Companies', width: 28, align: 'right' }, { label: 'Active', width: 24, align: 'right' }, { label: 'Learners', width: 26, align: 'right' }, { label: 'Share', align: 'right' }],
    (report.byState || []).map(r => [r.state || 'Not specified', String(r.organizations), String(r.active), String(r.learners), `${r.share}%`]),
    'No organizations registered in this period.',
  );
  pdf.section('Location - by city');
  pdf.table(
    [{ label: 'City', width: 52 }, { label: 'State', width: 52 }, { label: 'Companies', width: 28, align: 'right' }, { label: 'Learners', width: 26, align: 'right' }, { label: 'Share', align: 'right' }],
    (report.byCity || []).map(r => [r.city || 'Not specified', r.state || '-', String(r.organizations), String(r.learners), `${r.share}%`]),
    'No organizations registered in this period.',
  );

  pdf.section('Registered companies');
  pdf.table(
    [{ label: 'Company', width: 44 }, { label: 'Owner', width: 44 }, { label: 'Location', width: 34 }, { label: 'Registered', width: 24 }, { label: 'Learners', width: 20, align: 'right' }, { label: 'Status' }],
    (report.organizations || []).map(o => [o.name, o.owner?.email || '-', locationOf(o), dateLabel(o.registeredAt), String(o.learners), ORG_STATUS_LABEL[o.status] || o.status]),
    'No organizations registered in this period.',
  );

  pdf.save(`store-owner-report_${report.period?.from || 'all-time'}_to_${report.period?.to || todayYMD()}.pdf`);
}
