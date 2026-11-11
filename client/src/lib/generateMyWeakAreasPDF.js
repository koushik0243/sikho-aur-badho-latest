import { dateLabel, todayYMD } from '../Components/SuperAdmin/Reports/reportFormat';
import { percentText } from '../Components/SuperAdmin/Reports/traineeData';
import { PRIORITY, rulesText } from '../Components/Learner/Reports/weakAreasData';
import { createReportPdf } from './reportPdf';

const pr = v => percentText(v).replace('—', '-');
const PRIORITY_RGB = new Map(Object.values(PRIORITY).map(v => [v.label.replace(' priority', ''), v.rgb]));

/**
 * Downloads the learner's Weak Areas report (the same data as the page) as an A4 PDF.
 * @param {object} report response of GET /my-report/weak-areas
 * @param {{ course: string }} opts
 */
export async function generateMyWeakAreasPDF(report, { course }) {
  const pdf = await createReportPdf({
    title: 'My Weak Areas',
    subtitle: `${report.me?.name || 'Me'}   |   ${course}`,
    rightLines: [`Generated ${dateLabel(report.generatedAt || new Date())}`, 'What to revise next'],
  });
  const t = report.totals;

  pdf.tiles([
    ['Low chapters', `${t.lowChapters} (${t.highPriority} high)`],
    ['Skipped questions', `${t.skippedQuestions} (${t.stillSkipped} still)`],
    ['Lessons to watch', String(t.lessonsToWatch)],
    ['Quizzes to retake', String(t.quizzesToRetake)],
  ]);

  if (report.tips.length) {
    pdf.section('Revision suggestions', 24);
    pdf.note(report.tips.map(x => `- ${x}`).join('\n'));
  }

  pdf.section('Low chapters - your revision plan');
  if (!report.lowChapters.length) pdf.empty('No weak chapters - every chapter you started is on track.');
  report.lowChapters.forEach((c, i) => {
    pdf.section(`${i + 1}. ${c.chapter} - ${c.course}  (${PRIORITY[c.priority].label})`, 30);
    pdf.note(`Why: ${c.reasons.join('; ')}${c.lessons && c.lessonsWatched === c.lessons ? `; all ${c.lessons} lesson${c.lessons === 1 ? '' : 's'} watched` : ''}.`);
    pdf.note(c.steps.map((st, n) => `${n + 1}. ${st.text}`).join('\n'));
    if (c.feedback.length) pdf.note(`AI feedback: ${c.feedback.map(f => `"${f.question}" (${f.score}%): ${f.feedback}`).join('  |  ')}`);
  });

  pdf.section('Low chapters at a glance');
  pdf.table(
    [{ label: 'Chapter', width: 32, wrap: true }, { label: 'Course', width: 38, wrap: true }, { label: 'Priority', width: 20, color: v => PRIORITY_RGB.get(v) },
      { label: 'Best', width: 14, align: 'right' }, { label: 'Tries', width: 14, align: 'right' }, { label: 'Skipped', width: 20, align: 'right' },
      { label: 'Lessons', width: 20, align: 'right' }, { label: 'Progress', align: 'right' }],
    report.lowChapters.map(c => [c.chapter, c.course, PRIORITY[c.priority].label.replace(' priority', ''), c.bestScore === null ? '-' : `${c.bestScore}%`, String(c.attempts),
      pr(c.skipRate), c.lessons ? `${c.lessonsWatched}/${c.lessons}` : '-', `${c.progress}%`]),
    'No weak chapters.',
  );

  pdf.section('Skipped questions');
  pdf.table(
    [{ label: 'Question', width: 92, wrap: true }, { label: 'Quiz', width: 34, wrap: true }, { label: 'Skipped', width: 22, align: 'right' }, { label: 'Last time' }],
    report.skippedQuestions.map(q => [q.question, `${q.quiz} (${q.chapter})`, `${q.skipped}/${q.shown}`, q.stillSkipped ? 'Skipped' : `Answered ${q.lastScore}%`]),
    'You have not skipped any question.',
  );

  pdf.section('How weak areas are found', 24);
  pdf.note(rulesText(report.rules).map(x => `- ${x}`).join('\n'));

  pdf.save(`my-weak-areas_${todayYMD()}.pdf`);
}
