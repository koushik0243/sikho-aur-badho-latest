import { dateLabel, todayYMD } from '../Components/SuperAdmin/Reports/reportFormat';
import { percentText } from '../Components/SuperAdmin/Reports/traineeData';
import { GRADE_STYLE, LEVEL, duration, rulesText } from '../Components/StoreOwner/Reports/testResultsData';
import { createReportPdf } from './reportPdf';

const pc = v => percentText(v).replace('—', '-');
const time = v => (v === null || v === undefined ? '-' : duration(v));
const gradeColor = v => GRADE_STYLE[v]?.rgb;
const PASS_RGB = { Pass: [21, 128, 61], Fail: [185, 28, 28] };
const chapterText = c => (c ? `${c.chapter} (${c.score}%)` : '-');

/**
 * Downloads the Test Results report (the same data as the page) as an A4 PDF.
 * @param {object} report response of GET /org-report/test-results
 * @param {{ periodText: string, employee: string, course: string }} opts
 */
export async function generateTestResultsPDF(report, { periodText, employee, course }) {
  const pdf = await createReportPdf({
    title: 'Test Results',
    subtitle: `Taken ${periodText}   |   ${employee}   |   ${course}`,
    rightLines: [`Generated ${dateLabel(report.generatedAt || new Date())}`, 'Score, grade, skips, time, pass / fail'],
  });
  const t = report.totals;
  const oneEmployee = Boolean(report.filters.learnerId), oneCourse = Boolean(report.filters.courseId);

  pdf.tiles([
    ['Average score', `${pc(t.avgScore)}${t.grade ? `  (${t.grade})` : ''}`],
    ['Attempts pass / fail', `${t.attemptsPassed} / ${t.attemptsFailed}`],
    ['Questions skipped', `${pc(t.skipRate)} (${t.skipped})`],
    ['Avg time / attempt', t.avgTimeSec === null ? '-' : duration(t.avgTimeSec)],
  ]);
  pdf.note(`${t.attempts} quiz attempts on ${t.quizzes} quizzes by ${t.employees} employee${t.employees === 1 ? '' : 's'}; pass rate ${pc(t.passRate)}. Time is recorded for ${t.timedAttempts} of ${t.attempts} attempts.`);

  pdf.section('Grades', 32);
  pdf.splitBar(report.grades.map(g => ({ label: g.grade, value: report.gradeCounts[g.grade], rgb: GRADE_STYLE[g.grade].rgb })), 'Best attempt on each quiz');
  pdf.note(`Best chapter: ${report.bestChapter ? `${report.bestChapter.chapter} - ${report.bestChapter.course} (${report.bestChapter.avgScore}%)` : '-'}.   Worst chapter: ${report.worstChapter ? `${report.worstChapter.chapter} - ${report.worstChapter.course} (${report.worstChapter.avgScore}%)` : '-'}.`);

  pdf.section('Results per employee');
  pdf.table(
    [{ label: 'Employee', width: 30, wrap: true }, { label: 'Score', width: 15, align: 'right' }, { label: 'Grade', width: 14, color: gradeColor },
      { label: 'Best/worst', width: 22, align: 'right' }, { label: 'Tries', width: 13, align: 'right' }, { label: 'Pass/fail', width: 18, align: 'right' },
      { label: 'Skipped', width: 16, align: 'right' }, { label: 'Avg time', width: 18 }, { label: 'Best / worst chapter', wrap: true }],
    report.perEmployee.map(r => [r.name, pc(r.avgScore), r.grade || '-', `${r.bestScore}% / ${r.worstScore}%`, String(r.attempts), `${r.attemptsPassed} / ${r.attemptsFailed}`,
      pc(r.skipRate), time(r.avgTimeSec), `Best: ${chapterText(r.bestChapter)}\nWorst: ${chapterText(r.worstChapter)}`]),
    'No quiz attempts in this view.',
  );

  pdf.section('Results by chapter');
  pdf.table(
    [...(oneCourse ? [] : [{ label: 'Course', width: 34, wrap: true }]), { label: 'Chapter', width: oneCourse ? 56 : 30, wrap: true }, { label: 'People', width: 15, align: 'right' },
      { label: 'Tries', width: 13, align: 'right' }, { label: 'Avg score', width: 19, align: 'right' }, { label: 'Grade', width: 14, color: gradeColor },
      { label: 'Pass rate', width: 18, align: 'right' }, { label: 'Skipped', width: 17, align: 'right' }, { label: 'Avg time' }],
    report.chapterRows.map(r => [...(oneCourse ? [] : [r.course]), r.chapter, String(r.employees), String(r.attempts), pc(r.avgScore), r.grade || '-', pc(r.passRate), pc(r.skipRate), time(r.avgTimeSec)]),
    'No quiz attempts in this view.',
  );

  pdf.section('Attempts');
  pdf.table(
    [...(oneEmployee ? [] : [{ label: 'Employee', width: 26, wrap: true }]), ...(oneCourse ? [] : [{ label: 'Course', width: 26, wrap: true }]),
      { label: 'Chapter', width: 22 + (oneEmployee ? 26 : 0) + (oneCourse ? 26 : 0), wrap: true }, { label: '#', width: 8, align: 'right' }, { label: 'Date', width: 22 },
      { label: 'Score', width: 14, align: 'right' }, { label: 'Grade', width: 13, color: gradeColor }, { label: 'Result', width: 14, color: v => PASS_RGB[v] },
      { label: 'Skipped', width: 17, align: 'right' }, { label: 'Time' }],
    report.attempts.map(r => [...(oneEmployee ? [] : [r.name]), ...(oneCourse ? [] : [r.course]), r.chapter, String(r.attempt), dateLabel(r.takenAt),
      `${r.score}%`, r.grade, r.passed ? 'Pass' : 'Fail', `${r.skipped}/${r.questions}`, time(r.timeTakenSec)]),
    'No quiz attempts in this view.',
  );
  if (t.attempts > report.attempts.length) pdf.tableNote(`Showing the latest ${report.attempts.length} of ${t.attempts} attempts.`);

  pdf.section('Aptitude tests');
  pdf.table(
    [...(oneEmployee ? [] : [{ label: 'Employee', width: 34, wrap: true }]), { label: 'Course', width: oneEmployee ? 70 : 40, wrap: true }, { label: 'Date', width: 22 },
      { label: 'Score', width: 14, align: 'right' }, { label: 'Grade', width: 13, color: gradeColor }, { label: 'Level', width: 22 }, { label: 'Skipped', width: 17, align: 'right' }, { label: 'Time' }],
    report.aptitude.map(r => [...(oneEmployee ? [] : [r.name]), r.course, dateLabel(r.takenAt), `${r.score}%`, r.grade, LEVEL[r.level] || '-', `${r.skipped}/${r.questions}`, time(r.timeTakenSec)]),
    'No aptitude tests taken in this view.',
  );

  pdf.section('How results are worked out', 24);
  pdf.note(rulesText(report.grades).map(x => `- ${x}`).join('\n'));

  pdf.save(`test-results_${report.period?.from || 'all-time'}_to_${report.period?.to || todayYMD()}.pdf`);
}
