import { dateLabel, todayYMD } from '../Components/SuperAdmin/Reports/reportFormat';
import { percentText } from '../Components/SuperAdmin/Reports/traineeData';
import { GRADE_STYLE } from '../Components/StoreOwner/Reports/testResultsData';
import { ENROLLMENT_STATUS } from '../Components/StoreOwner/Reports/employeeProgressData';
import { VERDICT, DIFFICULTY_LABEL, rulesText } from '../Components/Learner/Reports/achievementsData';
import { createReportPdf } from './reportPdf';

const GREEN = [21, 128, 61], RED = [185, 28, 28], GRAY = [156, 163, 175];
const gradeColor = v => GRADE_STYLE[v]?.rgb;
const pr = v => percentText(v).replace('—', '-');
const VERDICT_RGB = new Map(Object.values(VERDICT).map(v => [v.label, v.rgb]));

/**
 * Downloads the learner's Achievements report (the same data as the page) as an A4 PDF.
 * @param {object} report response of GET /my-report/achievements
 * @param {{ course: string }} opts
 */
export async function generateMyAchievementsPDF(report, { course }) {
  const pdf = await createReportPdf({
    title: 'My Achievements',
    subtitle: `${report.me?.name || 'Me'}   |   ${course}`,
    rightLines: [`Generated ${dateLabel(report.generatedAt || new Date())}`, 'Certificates, grade, leaderboard'],
  });
  const t = report.totals;

  pdf.tiles([
    ['Certificates', String(t.certificates)],
    ['My grade', t.grade ? `${t.grade} (${t.myScore}%)` : '-'],
    ['Leaderboard', t.myRank ? `#${t.myRank} of ${t.leaderboardSize}` : '-'],
    ['Tests passed', `${t.testsPassed} of ${t.testsTaken}`],
  ]);
  pdf.note(`${t.totalAttempts} quiz attempts, ${t.firstTryPasses} passed on the first try. ${t.badgesEarned} of ${t.badges} badges earned.`);

  pdf.section('Badges');
  pdf.table(
    [{ label: 'Badge', width: 60 }, { label: 'Status', width: 30, color: v => (v === 'Earned' ? GREEN : GRAY) }, { label: 'How to earn' }],
    report.badges.map(b => [b.label, b.earned ? 'Earned' : 'Not yet', b.hint]),
    'No badges.',
  );

  pdf.section('Certificates');
  pdf.table(
    [{ label: 'Course', width: 90, wrap: true }, { label: 'Issued', width: 40 }, { label: 'Time taken', align: 'right' }],
    report.certificates.map(c => [c.course, dateLabel(c.issuedAt), c.daysTaken === null ? '-' : `${c.daysTaken} day${c.daysTaken === 1 ? '' : 's'}`]),
    'No certificates yet - complete a course to earn one.',
  );

  pdf.section('Grade by course');
  pdf.table(
    [{ label: 'Course', width: 90, wrap: true }, { label: 'Score', width: 25, align: 'right' }, { label: 'Grade', width: 22, color: gradeColor }, { label: 'Status' }],
    report.courseGrades.map(c => [c.course, c.score === null ? '-' : `${c.score}%`, c.grade || '-', ENROLLMENT_STATUS[c.status] || c.status]),
    'No courses.',
  );

  pdf.section('Leaderboard');
  pdf.table(
    [{ label: '#', width: 12 }, { label: 'Learner', width: 70 }, { label: 'Performance', width: 34, align: 'right' }, { label: 'Completed', width: 30, align: 'right' }, { label: 'Certificates', align: 'right' }],
    report.leaderboard.map(r => [String(r.rank), r.isMe ? 'You' : r.name, `${r.performance}%`, `${r.completed}/${r.courses}`, String(r.certificates)]),
    'No leaderboard - you are not part of an organization.',
  );

  const areaTable = (rows, empty) => pdf.table(
    [{ label: 'Chapter', width: 50, wrap: true }, { label: 'Course', width: 56, wrap: true }, { label: 'Best score', width: 26, align: 'right' }, { label: 'Quiz', width: 26, color: v => (v === 'Passed' ? GREEN : RED) }, { label: 'Tries', align: 'right' }],
    rows.map(r => [r.chapter, r.course, `${r.bestScore}%`, r.result === 'passed' ? 'Passed' : 'Not passed', String(r.attempts)]),
    empty,
  );
  pdf.section('My strong areas');
  areaTable(report.strong, `No strong areas yet - pass a chapter quiz with ${report.rules.STRONG}% or more.`);
  pdf.section('My weak areas');
  areaTable(report.weak, 'No weak areas - every quiz you took is passed.');

  pdf.section('By difficulty');
  pdf.table(
    [{ label: 'Difficulty', width: 50 }, { label: 'Score (answered)', width: 38, align: 'right' }, { label: 'Skipped', width: 26, align: 'right' }, { label: 'Verdict', width: 30, color: v => VERDICT_RGB.get(v) }, { label: 'Note' }],
    report.difficulty.map(d => [DIFFICULTY_LABEL[d.difficulty] || d.difficulty, d.avgScore === null ? '-' : `${d.avgScore}%`, pr(d.skipRate), VERDICT[d.verdict].label, d.oftenSkipped ? 'Often skipped' : '']),
    'No questions answered yet.',
  );

  pdf.section('Attempts');
  pdf.table(
    [{ label: 'Quiz', width: 40, wrap: true }, { label: 'Course', width: 40, wrap: true }, { label: 'Tries', width: 14, align: 'right' }, { label: 'Passed on', width: 26, color: v => (v === 'Not yet' ? RED : GREEN) },
      { label: 'Best', width: 16, align: 'right' }, { label: 'Last', width: 16, align: 'right' }, { label: 'Last tried' }],
    report.attempts.map(a => [a.quiz, a.course, String(a.attempts), a.passed ? (a.firstTry ? 'First try' : `Attempt ${a.passedOnAttempt}`) : 'Not yet', `${a.bestScore}%`, `${a.lastScore}%`, dateLabel(a.lastAt)]),
    'You have not taken a chapter quiz yet.',
  );

  pdf.section('How achievements are worked out', 24);
  pdf.note(rulesText(report.rules, report.grades).map(x => `- ${x}`).join('\n'));

  pdf.save(`my-achievements_${todayYMD()}.pdf`);
}
