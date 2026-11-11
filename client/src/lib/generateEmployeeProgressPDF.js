import { dateLabel, todayYMD } from '../Components/SuperAdmin/Reports/reportFormat';
import { ENROLLMENT_STATUS, CHAPTER_STATUS, QUIZ_RESULT, phaseText, quizSummary, RULES_TEXT } from '../Components/StoreOwner/Reports/employeeProgressData';
import { createReportPdf } from './reportPdf';

const STATUS_RGB = { Completed: [21, 128, 61], 'In progress': [13, 148, 136], 'Not started': [107, 114, 128], Stopped: [185, 28, 28] };
const RESULT_RGB = new Map(Object.values(QUIZ_RESULT).map(v => [v.label, v.rgb]));
// The PDF font has no ✓ ◐ ○: a phase cell is its text ('2/6', 'Certificate', 'Not started'…), coloured by status.
const phaseCell = (key, p) => (p.status === 'none' ? '-' : phaseText(key, p));

/**
 * Downloads the Employee Progress report (the same data as the page) as an A4 PDF.
 * @param {object} report response of GET /org-report/progress
 * @param {{ employee: string, course: string }} opts the filters shown on the page
 */
export async function generateEmployeeProgressPDF(report, { employee, course }) {
  const pdf = await createReportPdf({
    title: 'Employee Progress',
    subtitle: `${employee}   |   ${course}`,
    rightLines: [`Generated ${dateLabel(report.generatedAt || new Date())}`, 'Chapter-wise & phase-wise progress'],
  });
  const t = report.totals;
  const oneEmployee = Boolean(report.filters.learnerId), oneCourse = Boolean(report.filters.courseId);

  pdf.tiles([
    ['Average progress', t.avgProgress === null ? '-' : `${t.avgProgress}%`],
    ['Chapters completed', `${t.chaptersDone} of ${t.chapters}`],
    ['Quiz results', `${t.quizPassed} passed, ${t.quizFailed} failed`],
    ['Courses completed', `${t.completed} (${t.certificates} cert.)`],
  ]);
  pdf.note(`${t.enrollments} enrolled course${t.enrollments === 1 ? '' : 's'} for ${t.employees} employee${t.employees === 1 ? '' : 's'}. Progress is as of now.`);

  // ── Phase-wise ────────────────────────────────────────
  pdf.section('Phase-wise progress');
  pdf.table(
    [{ label: 'Phase', width: 52 }, { label: 'Courses', width: 18, align: 'right' }, { label: 'Finished', width: 20, align: 'right' }, { label: 'In progress', width: 24, align: 'right' },
      { label: 'Not started', width: 24, align: 'right' }, { label: 'Items done', width: 24, align: 'right' }, { label: 'Progress', align: 'right' }],
    report.phaseSummary.map((p, i) => [`${i + 1}. ${p.label}`, String(p.applicable), String(p.finished), String(p.inProgress), String(p.notStarted), p.total ? `${p.done} / ${p.total}` : '-', p.rate === null ? '-' : `${p.rate}%`]),
    'No enrolled courses.',
  );

  // ── Per employee (one block per enrollment, phases as rows) ──
  pdf.section('Progress per employee');
  pdf.table(
    [...(oneEmployee ? [] : [{ label: 'Employee', width: 33, wrap: true }]), ...(oneCourse ? [] : [{ label: 'Course', width: 28, wrap: true }]),
      { label: 'Aptitude', width: oneEmployee && oneCourse ? 34 : 22, wrap: true }, { label: 'Lessons', width: 16 }, { label: 'Quizzes', width: 22, wrap: true },
      { label: 'HW & Zoom', width: 19 }, { label: 'Completion', width: 22, wrap: true }, { label: 'Progress', align: 'right' }],
    report.enrollments.map(r => [
      ...(oneEmployee ? [] : [r.name]), ...(oneCourse ? [] : [r.course]),
      ...report.phases.map(p => phaseCell(p.key, r.phases[p.key])),
      `${r.progress}%`,
    ]),
    'No enrolled courses for this selection.',
  );
  pdf.note('Phases: 1 aptitude test, 2 lessons watched, 3 chapter quizzes passed, 4 homework & Zoom, 5 completion & certificate. "-" = not part of the course.');

  pdf.section('Results per employee');
  pdf.table(
    [...(oneEmployee ? [] : [{ label: 'Employee', width: 40, wrap: true }]), ...(oneCourse ? [] : [{ label: 'Course', width: 44, wrap: true }]),
      { label: 'Status', width: 24, color: v => STATUS_RGB[v] }, { label: 'Chapters', width: 18, align: 'right' }, { label: 'Quizzes', width: 34, wrap: true }, { label: 'Avg best', align: 'right' }],
    report.enrollments.map(r => [
      ...(oneEmployee ? [] : [r.name]), ...(oneCourse ? [] : [r.course]),
      ENROLLMENT_STATUS[r.status] || r.status, `${r.chaptersDone}/${r.chapters}`, quizSummary(r), r.avgBestScore === null ? '-' : `${r.avgBestScore}%`,
    ]),
    'No enrolled courses for this selection.',
  );

  // ── Chapter-wise ──────────────────────────────────────
  pdf.section('Chapter-wise progress');
  pdf.table(
    [...(oneEmployee ? [] : [{ label: 'Employee', width: 27, wrap: true }]), ...(oneCourse ? [] : [{ label: 'Course', width: 22, wrap: true }]),
      { label: 'Chapter', width: 21 + (oneEmployee ? 27 : 0) + (oneCourse ? 22 : 0), wrap: true }, { label: 'Lessons', width: 16, align: 'right' }, { label: 'Quiz', width: 17, color: v => RESULT_RGB.get(v) },
      { label: 'Best', width: 11, align: 'right' }, { label: 'Tries', width: 11, align: 'right' }, { label: 'HW/Zoom', width: 18, align: 'right' },
      { label: 'Progress', width: 18, align: 'right' }, { label: 'Status', wrap: true, color: v => STATUS_RGB[v] }],
    report.chapterRows.map(r => [
      ...(oneEmployee ? [] : [r.name]), ...(oneCourse ? [] : [r.course]), r.chapter,
      r.lessons ? `${r.lessonsDone}/${r.lessons}` : '-', QUIZ_RESULT[r.result].label,
      r.bestScore === null ? '-' : `${r.bestScore}%`, r.quizzes ? String(r.attempts) : '-',
      r.homework + r.zoom ? `${r.homeworkDone + r.zoomDone}/${r.homework + r.zoom}` : '-',
      `${r.progress}%`, CHAPTER_STATUS[r.status],
    ]),
    'No chapters for this selection.',
  );

  pdf.section('How progress and results are decided', 24);
  pdf.note(RULES_TEXT.map(x => `- ${x}`).join('\n'));

  const slug = v => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  pdf.save(`employee-progress_${slug(employee)}_${slug(course)}_${todayYMD()}.pdf`);
}
