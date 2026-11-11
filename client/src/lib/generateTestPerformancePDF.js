import { dateLabel, todayYMD } from '../Components/SuperAdmin/Reports/reportFormat';
import { percentText } from '../Components/SuperAdmin/Reports/traineeData';
import { OUTCOME, LEVELS, daysText, doneText } from '../Components/SuperAdmin/Reports/testPerformanceData';
import { createReportPdf } from './reportPdf';

const pc = v => percentText(v).replace('—', '-');
const days = v => daysText(v).replace('—', '-');

/**
 * Downloads the Test Performance report (the same data as the page) as an A4 PDF.
 * @param {object} report response of GET /report/test-performance
 * @param {{ periodText: string, organization: string, course: string, oneCourse: boolean }} opts
 */
export async function generateTestPerformancePDF(report, { periodText, organization, course, oneCourse }) {
  const pdf = await createReportPdf({
    title: 'Test Performance Report',
    subtitle: `Taken ${periodText}   |   ${organization}   |   ${course}`,
    rightLines: [`Generated ${dateLabel(report.generatedAt || new Date())}`, 'Quizzes, aptitude tests, homework, Zoom'],
  });
  const q = report.quiz, sk = report.skip, apt = report.aptitude, hw = report.homework, zm = report.zoom, cp = report.completion;
  const courseCol = (width) => (oneCourse ? [] : [{ label: 'Course', width }]);
  const courseVal = r => (oneCourse ? [] : [r.course]);

  pdf.tiles([
    ['Quiz pass rate', pc(q.passRate)],
    ['Questions skipped', pc(sk.rate)],
    ['Aptitude avg score', pc(apt.avgScore)],
    ['Avg completion time', days(cp.avgDays)],
  ]);
  pdf.note('The period filters quiz and aptitude attempts by the date taken, and completions by the date completed. Homework and Zoom show the current status of every enrolled learner.');

  // ── Pass / fail ───────────────────────────────────────
  pdf.section('Quiz pass / fail', 50);
  pdf.note(`${q.attempts} attempt${q.attempts === 1 ? '' : 's'}   |   average score ${pc(q.avgScore)}`);
  pdf.splitBar([
    { label: OUTCOME.passed.label, value: q.passed, rgb: OUTCOME.passed.rgb },
    { label: OUTCOME.failed.label, value: q.failed, rgb: OUTCOME.failed.rgb },
    { label: OUTCOME.pending.label, value: q.pendingEvaluation, rgb: OUTCOME.pending.rgb },
  ], 'Attempts');
  pdf.splitBar([
    { label: 'Passed', value: q.learnerQuizPassed, rgb: OUTCOME.passed.rgb },
    { label: 'Not passed yet', value: q.learnerQuizFailed, rgb: OUTCOME.failed.rgb },
  ], 'Learners per quiz');

  // ── Chapter-wise marks ────────────────────────────────
  pdf.section('Chapter-wise marks');
  pdf.table(
    [...courseCol(40), { label: 'Chapter', width: oneCourse ? 64 : 30 }, { label: 'Attempts', width: 18, align: 'right' }, { label: 'Learners', width: 18, align: 'right' },
      { label: 'Avg score', width: 19, align: 'right' }, { label: 'Avg best', width: 17, align: 'right' }, { label: 'Pass rate', width: 18, align: 'right' }, { label: 'Skip rate', align: 'right' }],
    report.chapterMarks.map(r => [...courseVal(r), r.chapter, String(r.attempts), String(r.learners), pc(r.avgScore), pc(r.avgBest), pc(r.passRate), pc(r.skipRate)]),
    'No quiz attempts in this view.',
  );
  pdf.note('Avg score = mean of all evaluated attempts. Avg best = each learner\'s best attempt, averaged.');

  // ── Question skip rate ────────────────────────────────
  pdf.section('Question skip rate');
  pdf.note(`${sk.skipped} of ${sk.shown} quiz questions skipped (${pc(sk.rate)}). Most skipped:`);
  pdf.table(
    [{ label: 'Question', width: oneCourse ? 100 : 70 }, ...courseCol(30), { label: 'Chapter', width: 26 }, { label: 'Shown', width: 16, align: 'right' },
      { label: 'Skipped', width: 18, align: 'right' }, { label: 'Skip rate', align: 'right' }],
    sk.mostSkipped.map(r => [r.question, ...courseVal(r), r.chapter, String(r.shown), String(r.skipped), pc(r.skipRate)]),
    'No skipped questions in this view.',
  );

  // ── Aptitude ──────────────────────────────────────────
  pdf.section('Aptitude test results', 40);
  pdf.note(`${apt.attempts} attempt${apt.attempts === 1 ? '' : 's'} by ${apt.learners} learner${apt.learners === 1 ? '' : 's'}   |   average score ${pc(apt.avgScore)}   |   skipped ${pc(apt.skipRate)}`);
  pdf.splitBar(LEVELS.map(lv => ({ label: lv.label, value: apt.levels[lv.key], rgb: lv.rgb })), 'Level reached');
  pdf.table(
    [{ label: 'Course', width: 54 }, { label: 'Attempts', width: 18, align: 'right' }, { label: 'Learners', width: 18, align: 'right' }, { label: 'Avg score', width: 20, align: 'right' },
      ...LEVELS.map((lv, i) => ({ label: lv.label, ...(i < LEVELS.length - 1 ? { width: lv.key === 'intermediate' ? 28 : 22 } : {}), align: 'right' }))],
    apt.byCourse.map(r => [r.course, String(r.attempts), String(r.learners), pc(r.avgScore), ...LEVELS.map(lv => String(r[lv.key]))]),
    'No aptitude tests taken in this view.',
  );

  // ── Homework + Zoom ───────────────────────────────────
  const activityTable = (rows, doneLabel, notDoneLabel, empty) => pdf.table(
    [{ label: 'Topic', width: oneCourse ? 58 : 36 }, ...courseCol(30), { label: 'Chapter', width: oneCourse ? 34 : 26 }, { label: 'Enrolled', width: 19, align: 'right' },
      { label: doneLabel, width: 17, align: 'right' }, { label: notDoneLabel, width: 22, align: 'right' }, { label: 'Rate', align: 'right' }],
    rows.map(r => [r.title, ...courseVal(r), r.chapter, String(r.enrolled), String(r.done), String(r.notDone), pc(r.rate)]),
    empty,
  );
  pdf.section('Homework done');
  if (hw.rows.length) pdf.note(`${doneText(hw.done, hw.enrolled, hw.rate)} done. Done = the learner marked the assignment done in the course player (there is no file upload).`);
  activityTable(hw.rows, 'Done', 'Not done', 'No homework assignments in the courses in this view.');

  pdf.section('Zoom meetings joined');
  if (zm.rows.length) pdf.note(`${doneText(zm.joined, zm.enrolled, zm.rate)} joined. Joined = the learner opened the meeting with the Join button in the course player.`);
  activityTable(zm.rows, 'Joined', 'Not joined', 'No Zoom sessions in the courses in this view.');

  // ── Completion time ───────────────────────────────────
  pdf.section('Course completion time', 30);
  pdf.note(`From the day the course was assigned to the day it was completed.   ${cp.count} completion${cp.count === 1 ? '' : 's'}   |   average ${days(cp.avgDays)}   |   median ${days(cp.medianDays)}   |   fastest ${days(cp.fastestDays)}   |   slowest ${days(cp.slowestDays)}`);
  if (cp.count === 0) {
    pdf.empty('No course completions in this view.');
  } else {
    if (!oneCourse) {
      pdf.table(
        [{ label: 'Course', width: 80 }, { label: 'Completions', width: 26, align: 'right' }, { label: 'Average', width: 26, align: 'right' }, { label: 'Fastest', width: 26, align: 'right' }, { label: 'Slowest', align: 'right' }],
        cp.byCourse.map(r => [r.course, String(r.completions), days(r.avgDays), days(r.fastestDays), days(r.slowestDays)]),
        '',
      );
    }
    pdf.section('Completed courses');
    pdf.table(
      [{ label: 'Learner', width: 36 }, { label: 'Organization', width: 30 }, ...courseCol(36), { label: 'Assigned', width: 24 }, { label: 'Completed', width: 24 }, { label: 'Time taken', align: 'right' }],
      cp.list.map(r => [r.name, r.organization, ...courseVal(r), dateLabel(r.enrolledAt), dateLabel(r.completedAt), days(r.days)]),
      '',
    );
    if (cp.count > cp.list.length) pdf.tableNote(`Showing the latest ${cp.list.length} of ${cp.count} completions.`);
  }

  pdf.save(`test-performance-report_${report.period?.from || 'all-time'}_to_${report.period?.to || todayYMD()}.pdf`);
}
