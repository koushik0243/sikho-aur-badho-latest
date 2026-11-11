import { money, monthLabel, dayLabel, dateLabel, ymdLabel, todayYMD } from '../Components/SuperAdmin/Reports/reportFormat';
import { percentText } from '../Components/SuperAdmin/Reports/traineeData';
import { COURSE_RANKINGS, ORG_RANKINGS, ranked, changeText } from '../Components/SuperAdmin/Reports/platformHealthData';
import { createReportPdf } from './reportPdf';

const rs = v => money(v, 'Rs.');
const pc = v => percentText(v).replace('—', '-');
const vs = (v, versus) => (changeText(v) === null ? `no sales ${versus} to compare` : `${changeText(v).replace('−', '-')} vs ${versus}`);

/**
 * Downloads the Platform Health report (the same data as the page) as an A4 PDF.
 * @param {object} report response of GET /report/platform-health
 * @param {{ periodText: string, courseRank: string, orgRank: string }} opts the period and the rankings chosen on the page
 */
export async function generatePlatformHealthPDF(report, { periodText, courseRank, orgRank }) {
  const pdf = await createReportPdf({
    title: 'Platform Health',
    subtitle: `As of ${ymdLabel(report.today)}   |   rankings & certificates: ${periodText}`,
    rightLines: [`Generated ${dateLabel(report.generatedAt || new Date())}`, 'DAU, revenue, certificates, rankings'],
  });
  const dau = report.dau, rev = report.revenue, cert = report.certificates;

  pdf.tiles([
    ['Active users today', `${dau.today.active} (yesterday ${dau.yesterday.active})`],
    ['Revenue MTD', rs(rev.mtd.revenue)],
    ['Revenue YTD', rs(rev.ytd.revenue)],
    ['Certificates issued', `${cert.issued} (${cert.total} all time)`],
  ]);
  pdf.note(`MTD: ${vs(rev.mtd.change, 'the same days last month')}. YTD: ${vs(rev.ytd.change, 'the same period last year')}. Active users and MTD / YTD are as of today; the period filters certificates and both rankings.`);

  // ── DAU ───────────────────────────────────────────────
  pdf.section(`Daily active users (DAU) - last ${dau.days} days`, 84);
  pdf.note(`Average DAU ${dau.avgDau}   |   active in ${dau.days} days (MAU) ${dau.mau} (${dau.mauLearners} learner${dau.mauLearners === 1 ? '' : 's'})   |   stickiness ${pc(dau.stickiness)}   |   busiest day ${dau.peak ? `${dayLabel(dau.peak.day)} (${dau.peak.active})` : '-'}`);
  pdf.columnChart(dau.daily.map(d => ({ shortLabel: dayLabel(d.day, true), value: d.active })), { formatAxis: v => String(Math.round(v)), integer: true });
  pdf.note(`Active = signed in or did any learning that day. ${dau.trackingSince ? `Sign-ins are counted from ${ymdLabel(dau.trackingSince)}; earlier days show learning activity only.` : 'Sign-in tracking has just started; past days show learning activity only.'}`);

  // ── Revenue to date ───────────────────────────────────
  pdf.section('Revenue to date');
  pdf.table(
    [{ label: 'Period', width: 52 }, { label: 'Dates', width: 64 }, { label: 'Orders', width: 26, align: 'right' }, { label: 'Revenue', align: 'right' }],
    [['Month to date', rev.mtd], ['Same days last month', rev.lastMonthToDate], ['All of last month', rev.lastMonth], ['Year to date', rev.ytd], ['Same period last year', rev.lastYearToDate]]
      .map(([label, r]) => [label, `${ymdLabel(r.from)} - ${ymdLabel(r.to)}`, String(r.orders), rs(r.revenue)]),
    '',
  );

  // ── Certificates ──────────────────────────────────────
  pdf.section('Certificates issued', 84);
  pdf.note(`${cert.issued} in this period to ${cert.learners} learner${cert.learners === 1 ? '' : 's'}; ${cert.total} all time.`);
  if (cert.issued && cert.monthly.length) {
    pdf.columnChart(cert.monthly.map(m => ({ shortLabel: monthLabel(m.month, true), value: m.issued })), { formatAxis: v => String(Math.round(v)), integer: true });
  }
  pdf.table(
    [{ label: 'Learner', width: 46 }, { label: 'Organization', width: 46 }, { label: 'Course', width: 58 }, { label: 'Issued' }],
    cert.latest.map(r => [r.name, r.organization, r.course, dateLabel(r.issuedAt)]),
    'No certificates issued in this period.',
  );

  // ── Rankings ──────────────────────────────────────────
  const courseLabel = COURSE_RANKINGS.find(r => r.value === courseRank)?.label || 'Enrollments';
  pdf.section(`Course ranking - by ${courseLabel.toLowerCase()}`);
  pdf.table(
    [{ label: '#', width: 8 }, { label: 'Course', width: 40, wrap: true }, { label: 'Enrolled', width: 18, align: 'right' }, { label: 'Learners', width: 18, align: 'right' },
      { label: 'Certs', width: 13, align: 'right' }, { label: 'Completion', width: 22, align: 'right' }, { label: 'Quiz pass', width: 19, align: 'right' },
      { label: 'Rating', width: 14, align: 'right' }, { label: 'Revenue', align: 'right' }],
    ranked(report.courseRanking, courseRank, 'title').map(r => [String(r.rank), r.title, String(r.enrollments), String(r.learners), String(r.certificates),
      pc(r.completionRate), pc(r.passRate), r.rating === null ? '-' : `${r.rating}/5`, rs(r.revenue)]),
    'No courses yet.',
  );

  const orgLabel = ORG_RANKINGS.find(r => r.value === orgRank)?.label || 'Revenue';
  pdf.section(`Organization ranking - by ${orgLabel.toLowerCase()}`);
  pdf.table(
    [{ label: '#', width: 8 }, { label: 'Organization', width: 44, wrap: true }, { label: 'Learners', width: 18, align: 'right' }, { label: `Active ${dau.days}d`, width: 24, align: 'right' },
      { label: 'Enrolled', width: 18, align: 'right' }, { label: 'Completion', width: 22, align: 'right' }, { label: 'Certs', width: 13, align: 'right' }, { label: 'Revenue', align: 'right' }],
    ranked(report.orgRanking, orgRank, 'name').map(r => [String(r.rank), r.location ? `${r.name} (${r.location})` : r.name, String(r.learners),
      `${r.activeLearners}${r.activeRate !== null ? ` (${r.activeRate}%)` : ''}`, String(r.enrollments), pc(r.completionRate), String(r.certificates), rs(r.revenue)]),
    'No organizations yet.',
  );
  pdf.note(`Learners are current; active learners are from the last ${dau.days} days; enrollments, certificates and revenue are for the period.`);

  pdf.save(`platform-health_${report.period?.from || 'all-time'}_to_${report.period?.to || todayYMD()}.pdf`);
}
