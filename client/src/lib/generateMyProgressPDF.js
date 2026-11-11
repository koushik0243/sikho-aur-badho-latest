import { dateLabel, todayYMD } from '../Components/SuperAdmin/Reports/reportFormat';
import { ENROLLMENT_STATUS, CHAPTER_STATUS, QUIZ_RESULT, phaseText } from '../Components/StoreOwner/Reports/employeeProgressData';
import { RULES_TEXT, testResultText } from '../Components/Learner/Reports/myProgressData';
import { createReportPdf } from './reportPdf';

const GREEN = [21, 128, 61], GRAY = [156, 163, 175];
const STATUS_RGB = { Completed: GREEN, 'In progress': [13, 148, 136], 'Not started': [107, 114, 128], Stopped: [185, 28, 28] };
const RESULT_RGB = new Map(Object.values(QUIZ_RESULT).map(v => [v.label, v.rgb]));
const LEVEL = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' };

/**
 * Downloads the learner's My Progress report (the same data as the page) as an A4 PDF.
 * @param {object} report response of GET /my-report/progress
 * @param {{ course: string }} opts
 */
export async function generateMyProgressPDF(report, { course }) {
  const name = report.me?.name || 'Me';
  const pdf = await createReportPdf({
    title: 'My Progress',
    subtitle: `${name}   |   ${course}`,
    rightLines: [`Generated ${dateLabel(report.generatedAt || new Date())}`, 'Progress as of now'],
  });
  const t = report.totals;
  const oneCourse = Boolean(report.filters.courseId);

  pdf.tiles([
    ['Overall', t.overall === null ? '-' : `${t.overall}%`],
    ['My score', t.myScore === null ? '-' : `${t.myScore}%`],
    ['Chapters done', `${t.chaptersDone} of ${t.chapters}`],
    ['Tests passed', `${t.testsPassed} of ${t.testsPassed + t.testsFailed}`],
  ]);
  pdf.note(`${t.chaptersPending} chapter${t.chaptersPending === 1 ? '' : 's'} pending. ${t.completedCourses} of ${t.courses} courses completed, ${t.certificates} certificate${t.certificates === 1 ? '' : 's'} earned.`);

  pdf.section('Chapters completed / pending', 24);
  pdf.splitBar([{ label: 'Completed', value: t.chaptersDone, rgb: GREEN }, { label: 'Pending', value: t.chaptersPending, rgb: GRAY }]);

  pdf.section('My courses');
  pdf.table(
    [{ label: 'Course', width: 46, wrap: true }, { label: 'Overall', width: 18, align: 'right' }, { label: 'Status', width: 24, color: v => STATUS_RGB[v] },
      { label: 'Chapters', width: 22, align: 'right' }, { label: 'Current chapter', wrap: true }],
    report.courses.map(c => [c.course, `${c.progress}%`, ENROLLMENT_STATUS[c.status] || c.status, `${c.chaptersDone}/${c.chapters}`,
      c.currentChapter ? `${c.currentChapter.title} (${c.currentChapter.progress}%)` : 'All chapters done']),
    'You have no courses yet.',
  );

  pdf.section('Phase status');
  pdf.table(
    [{ label: 'Course', width: 40, wrap: true }, { label: 'Aptitude', width: 26, wrap: true }, { label: 'Lessons', width: 20 }, { label: 'Quizzes', width: 26, wrap: true },
      { label: 'HW & Zoom', width: 22 }, { label: 'Completion', wrap: true }],
    report.courses.map(c => [c.course, ...report.phases.map(p => (c.phases[p.key].status === 'none' ? '-' : phaseText(p.key, c.phases[p.key])))]),
    'You have no courses yet.',
  );
  pdf.note('Phases: 1 aptitude test, 2 lessons watched, 3 chapter quizzes passed, 4 homework & Zoom, 5 completion & certificate. "-" = not part of the course.');

  pdf.section('Tests');
  pdf.table(
    [{ label: 'Quiz', width: oneCourse ? 50 : 34, wrap: true }, ...(oneCourse ? [] : [{ label: 'Course', width: 32, wrap: true }]), { label: 'Chapter', width: 26, wrap: true },
      { label: 'Result', width: 40, wrap: true, color: v => (v.startsWith('Passed') ? GREEN : [185, 28, 28]) }, { label: 'Pass mark', width: 20, align: 'right' }, { label: 'Tries', align: 'right' }],
    report.tests.map(q => [q.quiz, ...(oneCourse ? [] : [q.course]), q.chapter, testResultText(q), q.passMark === null ? '-' : `${q.passMark}%`, String(q.attempts)]),
    'No chapter quiz taken yet.',
  );
  if (report.aptitude.length) pdf.note(`Aptitude tests: ${report.aptitude.map(a => `${a.course} - ${LEVEL[a.level] || a.level} (${a.score}%)`).join('; ')}.`);

  pdf.section('Chapter-wise progress');
  pdf.table(
    [...(oneCourse ? [] : [{ label: 'Course', width: 32, wrap: true }]), { label: 'Chapter', width: oneCourse ? 52 : 30, wrap: true }, { label: 'Lessons', width: 17, align: 'right' },
      { label: 'Quiz', width: 18, color: v => RESULT_RGB.get(v) }, { label: 'Best', width: 13, align: 'right' }, { label: 'HW/Zoom', width: 19, align: 'right' },
      { label: 'Progress', width: 19, align: 'right' }, { label: 'Status', wrap: true, color: v => STATUS_RGB[v] }],
    report.chapterRows.map(r => [...(oneCourse ? [] : [r.course]), r.chapter, r.lessons ? `${r.lessonsDone}/${r.lessons}` : '-', QUIZ_RESULT[r.result].label,
      r.bestScore === null ? '-' : `${r.bestScore}%`, r.homework + r.zoom ? `${r.homeworkDone + r.zoomDone}/${r.homework + r.zoom}` : '-', `${r.progress}%`, CHAPTER_STATUS[r.status]]),
    'No chapters.',
  );

  pdf.section('How your progress is worked out', 24);
  pdf.note(RULES_TEXT.map(x => `- ${x}`).join('\n'));

  pdf.save(`my-progress_${todayYMD()}.pdf`);
}
