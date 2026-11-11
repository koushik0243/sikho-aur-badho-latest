import { monthLabel, dateLabel, todayYMD } from '../Components/SuperAdmin/Reports/reportFormat';
import { TRAINEE_STATUS, STATUS_KEYS, statusCount, percentText } from '../Components/SuperAdmin/Reports/traineeData';
import { createReportPdf } from './reportPdf';

const GREEN = [21, 128, 61], GRAY = [156, 163, 175];

/**
 * Downloads the Trainees report (the same data as the page) as an A4 PDF.
 * @param {object} report response of GET /report/trainees
 * @param {{ periodText: string, organization: string, course: string, oneCourse: boolean }} opts
 */
export async function generateTraineePDF(report, { periodText, organization, course, oneCourse }) {
  const pdf = await createReportPdf({
    title: 'Trainee Report',
    subtitle: `Enrolled ${periodText}   |   ${organization}   |   ${course}`,
    rightLines: [`Generated ${dateLabel(report.generatedAt || new Date())}`, `Dropout = no activity for ${report.dropoutDays}+ days`],
  });
  const t = report.totals, l = report.learners;
  pdf.tiles([
    ['Enrolled', String(t.enrolled)],
    ['Completed', `${t.completed} (${t.completionRate}%)`],
    ['Pending', String(t.pending)],
    ['Dropout', `${t.dropout} (${t.dropoutRate}%)`],
  ]);
  pdf.note(`One enrollment = one course assigned to one learner. Pending = ${t.inProgress} in progress + ${t.notStarted} not started. Dropout = not completed and no learning activity for ${report.dropoutDays}+ days.`);

  pdf.section('Enrollment status', 32);
  pdf.splitBar(STATUS_KEYS.map(k => ({ label: TRAINEE_STATUS[k].label, value: statusCount(t, k), rgb: TRAINEE_STATUS[k].rgb })));

  pdf.section('Active / inactive learners', 50);
  pdf.note(`${l.total} learner${l.total === 1 ? '' : 's'} with enrollments in this view.`);
  pdf.splitBar([{ label: 'Active', value: l.active, rgb: GREEN }, { label: 'Inactive', value: l.inactive, rgb: GRAY }], `Learning in the last ${report.dropoutDays} days`);
  pdf.splitBar([{ label: 'Active', value: l.accountActive, rgb: GREEN }, { label: 'Inactive', value: l.accountInactive, rgb: GRAY }], 'Account status');

  pdf.section('Enrollments per month', 72);
  const months = report.monthly || [];
  if (months.length) {
    pdf.columnChart(months.map(m => ({ shortLabel: monthLabel(m.month, true), value: m.enrolled })), { formatAxis: v => String(Math.round(v)), integer: true });
  } else {
    pdf.empty('No enrollments in this view.');
  }

  pdf.section('Chapter-wise performance');
  const chapterCols = oneCourse
    ? [{ label: 'Chapter', width: 56 }]
    : [{ label: 'Course', width: 28 }, { label: 'Chapter', width: 28 }];
  pdf.table(
    [...chapterCols, { label: 'Enrolled', width: 21, align: 'right' }, { label: 'Started', width: 22, align: 'right' }, { label: 'Lessons', width: 20, align: 'right' },
      { label: 'Took quiz', width: 22, align: 'right' }, { label: 'Pass rate', width: 21, align: 'right' }, { label: 'Avg score', align: 'right' }],
    (report.chapters || []).map(r => [
      ...(oneCourse ? [] : [r.course]), r.chapter, String(r.enrolled), `${r.started} (${r.startedPct}%)`, percentText(r.lessonCompletion),
      r.hasQuiz ? String(r.quizTakers) : '-', percentText(r.passRate), percentText(r.avgScore),
    ].map(v => (v === '—' ? '-' : v))),
    'No chapters for the courses in this view.',
  );
  pdf.note('Lessons = average share of the chapter\'s lesson videos fully watched. Pass rate and average (best) score count learners who took the chapter quiz.');

  pdf.section('Trainees');
  pdf.table(
    [{ label: 'Learner', width: 32 }, { label: 'Organization', width: 28 }, { label: 'Course', width: 32 }, { label: 'Enrolled', width: 22 },
      { label: 'Progress', width: 20, align: 'right' }, { label: 'Status', width: 21 }, { label: 'Last activity' }],
    (report.trainees || []).map(r => [r.name, r.organization, r.course, dateLabel(r.enrolledAt), `${r.progress}%`, TRAINEE_STATUS[r.status]?.label || r.status, r.lastActivity ? dateLabel(r.lastActivity) : 'Never']),
    'No enrollments in this view.',
  );
  if (report.traineeCount > (report.trainees || []).length) {
    pdf.tableNote(`Showing ${report.trainees.length} of ${report.traineeCount} enrollments (dropouts first).`);
  }

  pdf.save(`trainee-report_${report.period?.from || 'all-time'}_to_${report.period?.to || todayYMD()}.pdf`);
}
