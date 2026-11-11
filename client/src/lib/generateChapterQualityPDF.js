import { dateLabel, todayYMD } from '../Components/SuperAdmin/Reports/reportFormat';
import { percentText } from '../Components/SuperAdmin/Reports/traineeData';
import { SEVERITY, FLAG_KIND, rulesText } from '../Components/SuperAdmin/Reports/chapterQualityData';
import { createReportPdf } from './reportPdf';

const pc = v => percentText(v).replace('—', '-');
const LABEL_TO_RGB = new Map(Object.values(SEVERITY).map(v => [v.label, v.rgb]));
const sevColor = label => LABEL_TO_RGB.get(label);
/** 'Weak: pass rate 0%, avg score 0%. Difficult: ...' */
const whyText = flags => Object.keys(FLAG_KIND)
  .map(kind => [kind, flags.filter(f => f.kind === kind).map(f => f.text.charAt(0).toLowerCase() + f.text.slice(1))])
  .filter(([, list]) => list.length)
  .map(([kind, list]) => `${FLAG_KIND[kind]}: ${list.join(', ')}.`).join(' ');

/**
 * Downloads the Chapter Quality Alert report (the same data as the page) as an A4 PDF.
 * @param {object} report response of GET /report/chapter-quality
 * @param {{ periodText: string, course: string, oneCourse: boolean }} opts
 */
export async function generateChapterQualityPDF(report, { periodText, course, oneCourse }) {
  const pdf = await createReportPdf({
    title: 'Chapter Quality Alert',
    subtitle: `Quizzes taken ${periodText}   |   ${course}`,
    rightLines: [`Generated ${dateLabel(report.generatedAt || new Date())}`, 'Weak chapters, questions, content issues'],
  });
  const sm = report.summary;
  const flagged = report.chapters.filter(c => c.severity !== 'ok');
  const courseCol = width => (oneCourse ? [] : [{ label: 'Course', width }]);
  const courseVal = r => (oneCourse ? [] : [r.course]);

  pdf.tiles([
    ['Chapters flagged', String(flagged.length)],
    ['Failed questions', String(sm.failedQuestions)],
    ['Skipped questions', String(sm.skippedQuestions)],
    ['Content issues', `${sm.contentIssues} (${sm.criticalIssues} critical)`],
  ]);
  pdf.note(`${sm.chaptersChecked} chapters checked, ${sm.chaptersWithQuizData} with quiz attempts in this period. ${sm.weakChapters} weak and ${sm.difficultChapters} difficult. The period filters quiz attempts and reviews; content issues are the current state of the course builder.`);

  // ── Weak & difficult chapters ─────────────────────────
  pdf.section('Weak & difficult chapters');
  pdf.table(
    [{ label: 'Alert', width: 17, color: sevColor }, ...courseCol(28), { label: 'Chapter', width: oneCourse ? 40 : 22, wrap: true }, { label: 'Learners', width: 18, align: 'right' },
      { label: 'Pass', width: 12, align: 'right' }, { label: '1st try', width: 14, align: 'right' }, { label: 'Score', width: 13, align: 'right' },
      { label: 'Skip', width: 13, align: 'right' }, { label: 'Why', wrap: true }],
    flagged.map(r => [SEVERITY[r.severity].label, ...courseVal(r), r.chapter, String(r.learners), pc(r.passRate), pc(r.firstTryRate), pc(r.avgScore), pc(r.skipRate),
      whyText(r.flags)]),
    'No chapter alerts. Every chapter with enough quiz attempts is doing fine.',
  );

  // ── Questions ─────────────────────────────────────────
  const more = (shown, total) => { if (total > shown) pdf.tableNote(`Showing the top ${shown} of ${total}.`); };
  pdf.section('Failed questions');
  pdf.table(
    [{ label: 'Question', width: oneCourse ? 94 : 66, wrap: true }, ...courseCol(28), { label: 'Chapter', width: 24 }, { label: 'Answers', width: 18, align: 'right' },
      { label: 'Failed', width: 14, align: 'right' }, { label: 'Fail rate', width: 17, align: 'right' }, { label: 'Marks', align: 'right' }],
    report.failedQuestions.map(q => [`${q.question}${q.removed ? ' (removed)' : ''}`, ...courseVal(q), q.chapter, String(q.answered), String(q.failed), pc(q.failRate), pc(q.avgScore)]),
    'No question is failed by most learners in this view.',
  );
  more(report.failedQuestions.length, sm.failedQuestions);

  pdf.section('Skipped questions');
  pdf.table(
    [{ label: 'Question', width: oneCourse ? 108 : 80, wrap: true }, ...courseCol(28), { label: 'Chapter', width: 24 }, { label: 'Shown', width: 14, align: 'right' },
      { label: 'Skipped', width: 16, align: 'right' }, { label: 'Skip rate', align: 'right' }],
    report.skippedQuestions.map(q => [`${q.question}${q.removed ? ' (removed)' : ''}`, ...courseVal(q), q.chapter, String(q.shown), String(q.skipped), pc(q.skipRate)]),
    'No question is skipped by most learners in this view.',
  );
  more(report.skippedQuestions.length, sm.skippedQuestions);

  // ── Content issues ────────────────────────────────────
  pdf.section('Content issues');
  if (report.contentIssues.length) pdf.note(`${sm.criticalIssues} critical (learners are blocked), ${sm.warningIssues} warnings, ${sm.infoIssues} notes.`);
  pdf.table(
    [{ label: 'Level', width: 19, color: sevColor }, { label: 'Type', width: 18 }, ...courseCol(28), { label: 'Chapter', width: 22 }, { label: 'Item', width: oneCourse ? 46 : 34, wrap: true }, { label: 'Problem / fix', wrap: true }],
    report.contentIssues.map(i => [SEVERITY[i.severity].label, i.type, ...courseVal(i), i.chapter, i.item, `${i.problem}. ${i.fix}`]),
    'No content issues found.',
  );

  pdf.section('Low-rated chapters (learner reviews)');
  pdf.table(
    [{ label: 'Rating', width: 16, align: 'right' }, ...courseCol(30), { label: 'Chapter', width: 28 }, { label: 'Learner', width: 28 }, { label: 'Comment', width: oneCourse ? 86 : 56, wrap: true }, { label: 'Date' }],
    report.lowReviews.map(r => [`${r.rating} / 5`, ...courseVal(r), r.chapter, r.learner, r.text, dateLabel(r.createdAt)]),
    `No chapter reviews rated ${report.rules.LOW_REVIEW} or lower in this view.`,
  );

  pdf.section('How alerts are decided', 24);
  pdf.note(rulesText(report.rules).map(t => `- ${t}`).join('\n'));

  pdf.save(`chapter-quality-alert_${report.period?.from || 'all-time'}_to_${report.period?.to || todayYMD()}.pdf`);
}
