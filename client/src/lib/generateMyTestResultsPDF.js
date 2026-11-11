import { dateLabel, todayYMD } from '../Components/SuperAdmin/Reports/reportFormat';
import { percentText } from '../Components/SuperAdmin/Reports/traineeData';
import { BAND_STYLE, DIFFICULTY_LABEL, duration, resultText, RULES_TEXT } from '../Components/Learner/Reports/myTestResultsData';
import { createReportPdf } from './reportPdf';

const pc = v => (v === null || v === undefined ? '-' : `${v}%`);
const pr = v => percentText(v).replace('—', '-');
const time = v => (v === null || v === undefined ? '-' : duration(v));
const RESULT_RGB = { Passed: [21, 128, 61], 'Not passed': [185, 28, 28] };

/**
 * Downloads the learner's Test Results report (the same data as the page) as an A4 PDF.
 * @param {object} report response of GET /my-report/test-results
 * @param {{ periodText: string, course: string }} opts
 */
export async function generateMyTestResultsPDF(report, { periodText, course }) {
  const pdf = await createReportPdf({
    title: 'My Test Results',
    subtitle: `${report.me?.name || 'Me'}   |   taken ${periodText}   |   ${course}`,
    rightLines: [`Generated ${dateLabel(report.generatedAt || new Date())}`, 'Speech & MCQ scores, skip analysis'],
  });
  const t = report.totals, sp = report.speech, mcq = report.mcq;
  const oneCourse = Boolean(report.filters.courseId);

  pdf.tiles([
    ['Speech score', pc(sp.avgScore)],
    ['MCQ score', mcq.questions ? pc(mcq.avgScore) : 'No MCQs yet'],
    ['Test score', pc(t.testScore)],
    ['Questions skipped', `${pr(t.skipRate)} (${t.skipped}/${t.shown})`],
  ]);
  pdf.note(`${t.quizAttempts} chapter quiz attempt${t.quizAttempts === 1 ? '' : 's'} and ${t.aptitudeAttempts} aptitude test${t.aptitudeAttempts === 1 ? '' : 's'}.${t.allSkippedAttempts ? ` ${t.allSkippedAttempts} submitted without any answer.` : ''}${t.blankAnswers ? ` ${t.blankAnswers} blank answers counted as skipped.` : ''}`);

  const scoreSection = (title, block, empty) => {
    pdf.section(title, 34);
    if (!block.questions) { pdf.note(empty); return; }
    pdf.note(`Score on answered questions ${pc(block.avgScore)}   |   with skips as 0: ${pc(block.overallScore)}   |   answered ${block.answered} of ${block.questions}`);
    pdf.splitBar(report.bands.map(b => ({ label: b.label, value: block.bands[b.key], rgb: BAND_STYLE[b.key].rgb })), 'Your answers');
  };
  scoreSection('Speech scores', sp, 'No spoken answers in this view.');
  scoreSection('MCQ scores', mcq, 'Your tests have no multiple-choice questions yet - every question so far is answered by speaking.');

  pdf.section('Skips by difficulty');
  pdf.table(
    [{ label: 'Difficulty', width: 60 }, { label: 'Questions', width: 30, align: 'right' }, { label: 'Skipped', width: 40, align: 'right' }, { label: 'Score (answered)', align: 'right' }],
    report.byDifficulty.map(r => [DIFFICULTY_LABEL[r.difficulty] || r.difficulty, String(r.shown), `${r.skipped} (${pr(r.skipRate)})`, pc(r.avgScore)]),
    'No questions in this view.',
  );
  pdf.section('Skips by question position');
  pdf.table(
    [{ label: 'Position', width: 70 }, { label: 'Questions', width: 40, align: 'right' }, { label: 'Skipped', align: 'right' }],
    report.byPosition.map(r => [r.label, String(r.shown), `${r.skipped} (${pr(r.skipRate)})`]),
    'No questions in this view.',
  );

  pdf.section('Skips by test');
  pdf.table(
    [{ label: 'Test', width: oneCourse ? 52 : 34, wrap: true }, ...(oneCourse ? [] : [{ label: 'Course', width: 32, wrap: true }]), { label: 'Chapter', width: 24, wrap: true },
      { label: 'Tries', width: 13, align: 'right' }, { label: 'Best', width: 15, align: 'right' }, { label: 'Speech', width: 17, align: 'right' }, { label: 'Skipped', align: 'right' }],
    report.byTest.map(r => [r.kind === 'aptitude' ? 'Aptitude test' : r.test, ...(oneCourse ? [] : [r.course]), r.chapter, String(r.attempts), pc(r.bestScore), pc(r.speechScore), `${r.skipped}/${r.shown} (${pr(r.skipRate)})`]),
    'No tests in this view.',
  );

  pdf.section('My attempts');
  pdf.table(
    [{ label: 'Date', width: 24 }, { label: 'Test', width: oneCourse ? 52 : 32, wrap: true }, ...(oneCourse ? [] : [{ label: 'Course', width: 28, wrap: true }]),
      { label: 'Score', width: 15, align: 'right' }, { label: 'Result', width: 24, color: v => RESULT_RGB[v] }, { label: 'Answered', width: 20, align: 'right' },
      { label: 'Skipped', width: 17, align: 'right' }, { label: 'Time' }],
    report.attempts.map(r => [dateLabel(r.takenAt), r.kind === 'aptitude' ? 'Aptitude test' : `${r.test} (${r.chapter})`, ...(oneCourse ? [] : [r.course]),
      `${r.score}%`, resultText(r), `${r.answered}/${r.questions}`, pr(r.skipRate), time(r.timeTakenSec)]),
    'No tests taken in this view.',
  );

  pdf.section('Questions I skip most');
  pdf.table(
    [{ label: 'Question', width: 120, wrap: true }, { label: 'Test', width: 36, wrap: true }, { label: 'Skipped', align: 'right' }],
    report.mostSkipped.map(r => [r.question, r.test, `${r.skipped}/${r.shown}`]),
    'You have not skipped any question.',
  );
  pdf.section('My lowest-scoring answers');
  pdf.table(
    [{ label: 'Question', width: 70, wrap: true }, { label: 'Score', width: 16, align: 'right' }, { label: 'AI feedback', wrap: true }],
    report.lowestScored.map(r => [r.question, `${r.avgScore}%`, r.feedback || '-']),
    'No spoken answers yet.',
  );

  pdf.section('How your results are worked out', 24);
  pdf.note(RULES_TEXT.map(x => `- ${x}`).join('\n'));

  pdf.save(`my-test-results_${report.period?.from || 'all-time'}_to_${report.period?.to || todayYMD()}.pdf`);
}
