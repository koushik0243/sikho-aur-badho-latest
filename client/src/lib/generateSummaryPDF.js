import { dateLabel, todayYMD } from '../Components/SuperAdmin/Reports/reportFormat';
import { percentText } from '../Components/SuperAdmin/Reports/traineeData';
import { RULES_TEXT } from '../Components/StoreOwner/Reports/summaryData';
import { createReportPdf } from './reportPdf';

const pc = v => percentText(v).replace('—', '-');
const GREEN = [21, 128, 61], GRAY = [156, 163, 175], RED = [185, 28, 28];
const YES_NO_RGB = { Attended: GREEN, 'Not attended': RED, Done: GREEN, 'Not done': RED };
const ratio = (d, t) => (t ? `${d}/${t}` : '-');

/**
 * Downloads the Summary report (the same data as the page) as an A4 PDF.
 * @param {object} report response of GET /org-report/summary
 * @param {{ course: string }} opts
 */
export async function generateSummaryPDF(report, { course }) {
  const pdf = await createReportPdf({
    title: 'Store Summary',
    subtitle: `${course}   |   as of ${dateLabel(report.generatedAt || new Date())}`,
    rightLines: [`Generated ${dateLabel(report.generatedAt || new Date())}`, 'Completion, performers, Zoom, homework'],
  });
  const t = report.totals;
  const oneCourse = Boolean(report.filters.courseId);

  pdf.tiles([
    ['Store completion', `${pc(t.completionRate)} (${t.completed}/${t.enrollments})`],
    ['Average progress', t.avgProgress === null ? '-' : `${t.avgProgress}%`],
    ['Zoom attended', `${pc(t.zoomRate)} (${t.zoomDone}/${t.zoom})`],
    ['Homework done', `${pc(t.homeworkRate)} (${t.homeworkDone}/${t.homework})`],
  ]);
  pdf.note(`${t.employees} of ${t.staff} employees have courses. ${t.chaptersDone} of ${t.chapters} chapters completed, ${t.certificates} certificates, quizzes ${t.quizPassed} passed / ${t.quizFailed} failed.`);

  pdf.section('Store completion', 46);
  pdf.splitBar([{ label: 'Completed', value: t.completed, rgb: GREEN }, { label: 'Not completed', value: t.enrollments - t.completed, rgb: GRAY }], 'Enrolled courses');
  pdf.splitBar([{ label: 'Completed', value: t.chaptersDone, rgb: GREEN }, { label: 'Not completed', value: t.chapters - t.chaptersDone, rgb: GRAY }], 'Chapters');

  pdf.section('Zoom & homework', 46);
  pdf.splitBar([{ label: 'Attended', value: t.zoomDone, rgb: GREEN }, { label: 'Not attended', value: t.zoom - t.zoomDone, rgb: RED }], 'Zoom sessions');
  pdf.splitBar([{ label: 'Done', value: t.homeworkDone, rgb: GREEN }, { label: 'Not done', value: t.homework - t.homeworkDone, rgb: RED }], 'Homework');

  const performerTable = (rows, weak) => pdf.table(
    [{ label: '#', width: 9 }, { label: 'Employee', width: 46, wrap: true }, { label: 'Performance', width: 24, align: 'right' }, { label: 'Progress', width: 19, align: 'right' },
      { label: 'Quiz', width: 15, align: 'right' }, { label: 'Done', width: 15, align: 'right' }, { label: weak ? 'Why' : 'Certificates', wrap: true }],
    rows.map(e => [`${e.rank}`, e.name, `${e.performance}%`, `${e.avgProgress}%`, e.quizScore === null ? '-' : `${e.quizScore}%`, `${e.completed}/${e.courses}`,
      weak ? (e.reasons.join(', ') || '-') : String(e.certificates)]),
    weak ? 'No weak performers - everyone is making progress.' : 'No one has made progress yet.',
  );
  pdf.section('Best performers');
  performerTable(report.best, false);
  pdf.section('Weak performers');
  performerTable(report.weak, true);

  pdf.section('Employee ranking');
  pdf.table(
    [{ label: '#', width: 9 }, { label: 'Employee', width: 44, wrap: true }, { label: 'Performance', width: 24, align: 'right' }, { label: 'Progress', width: 19, align: 'right' },
      { label: 'Quiz', width: 15, align: 'right' }, { label: 'Completed', width: 21, align: 'right' }, { label: 'Zoom', width: 16, align: 'right' }, { label: 'Homework', align: 'right' }],
    report.employees.map(e => [`${e.rank}`, e.name, `${e.performance}%`, `${e.avgProgress}%`, e.quizScore === null ? '-' : `${e.quizScore}%`, `${e.completed}/${e.courses}`, ratio(e.zoomDone, e.zoom), ratio(e.homeworkDone, e.homework)]),
    'No employee has a course yet.',
  );

  const sessionTable = (rows, doneLabel, notLabel, empty) => pdf.table(
    [{ label: 'Session', width: oneCourse ? 50 : 32, wrap: true }, ...(oneCourse ? [] : [{ label: 'Course', width: 30, wrap: true }]), { label: 'Chapter', width: 22, wrap: true },
      { label: doneLabel, width: 22, align: 'right' }, { label: 'Rate', width: 15, align: 'right' }, { label: notLabel, wrap: true }],
    rows.map(r => [r.title, ...(oneCourse ? [] : [r.course]), r.chapter, `${r.done}/${r.enrolled}`, pc(r.rate), r.missing.join(', ') || 'Everyone']),
    empty,
  );
  pdf.section('Zoom sessions');
  sessionTable(report.zoomSessions, 'Attended', 'Not attended', 'No Zoom sessions in these courses.');

  const rowTable = (rows, label, empty) => pdf.table(
    [{ label: 'Employee', width: 40, wrap: true }, { label: label === 'Zoom' ? 'Session' : 'Homework', width: oneCourse ? 66 : 38, wrap: true }, ...(oneCourse ? [] : [{ label: 'Course', width: 28, wrap: true }]),
      { label: 'Status', width: 28, color: v => YES_NO_RGB[v] }, { label: 'On' }],
    rows.map(r => [r.name, `${r.title} (${r.chapter})`, ...(oneCourse ? [] : [r.course]), label === 'Zoom' ? (r.done ? 'Attended' : 'Not attended') : (r.done ? 'Done' : 'Not done'), r.doneAt ? dateLabel(r.doneAt) : '-']),
    empty,
  );
  pdf.section('Zoom attended or not');
  rowTable(report.zoomRows, 'Zoom', 'No Zoom sessions in these courses.');

  pdf.section('Homework');
  sessionTable(report.homeworkItems, 'Done', 'Not done', 'No homework in these courses.');
  pdf.section('Homework done or not');
  rowTable(report.homeworkRows, 'Homework', 'No homework in these courses.');

  pdf.section('How the summary is worked out', 24);
  pdf.note(RULES_TEXT.map(x => `- ${x}`).join('\n'));

  pdf.save(`store-summary_${oneCourse ? 'course' : 'all-courses'}_${todayYMD()}.pdf`);
}
