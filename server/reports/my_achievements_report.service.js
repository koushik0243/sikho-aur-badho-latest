import mongoose from 'mongoose';
import { getMyProgressReport } from './my_progress_report.service.js';
import { getMyTestResultsReport } from './my_test_results_report.service.js';
import { getOrgSummaryReport } from './org_summary_report.service.js';
import { GRADES, gradeOf } from './org_test_results_report.service.js';
import { avg, pct } from './report_stats.js';

const { ObjectId } = mongoose.Types;
const oid = (v) => String(v || '');
const round = (n) => Math.round(n);
const LEADERBOARD_SIZE = 10;
const STRONG = 75; // best score at or above = strong area
const WEAK = 50;   // best score below (or quiz not passed) = weak area

/** 'Koushik Kumar Rudra' → 'Koushik R.' — colleagues are shown by first name and last initial. */
const shortName = (name) => {
  const parts = String(name || 'Learner').trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};

/**
 * A learner's achievements: certificates, grade, leaderboard, strong / weak
 * areas and attempts.
 * @param {{ userId: string, courseId?: string }} filters
 */
export async function getMyAchievementsReport({ userId, courseId }) {
  const db = mongoose.connection.db;
  const me = new ObjectId(userId);
  const [progress, results, user, completions] = await Promise.all([
    getMyProgressReport({ userId, courseId }),
    getMyTestResultsReport({ userId, courseId }),
    db.collection('users').findOne({ _id: me }, { projection: { name: 1, orgId: 1 } }),
    db.collection('course_completions').find({ userId: me, ...(courseId ? { courseId: new ObjectId(courseId) } : {}) }).sort({ completedAt: -1 }).toArray(),
  ]);

  // ── Certificates ──────────────────────────────────────
  const certCourses = await db.collection('courses').find({ _id: { $in: completions.map(c => c.courseId) } }).project({ title: 1, deletedAt: 1, status: 1 }).toArray();
  const certCourse = new Map(certCourses.map(c => [oid(c._id), c]));
  const enrolledAt = new Map(progress.courses.map(c => [c.courseId, c.enrolledAt]));
  const certificates = completions.map(c => {
    const course = certCourse.get(oid(c.courseId));
    const removed = !course || course.deletedAt || course.status === 'deleted';
    const started = enrolledAt.get(oid(c.courseId));
    return {
      courseId: oid(c.courseId), course: `${course?.title || 'Course'}${removed ? ' (deleted)' : ''}`, issuedAt: c.completedAt,
      daysTaken: started ? Math.max(0, Math.round((new Date(c.completedAt) - new Date(started)) / 86400000)) : null,
      viewable: !removed, // the certificate page needs the course
    };
  });

  // ── Grade: overall and per course ─────────────────────
  const tests = progress.tests;
  const byCourse = new Map();
  tests.forEach(t => byCourse.set(t.courseId, [...(byCourse.get(t.courseId) || []), t.bestScore]));
  const courseGrades = progress.courses.map(c => {
    const scores = byCourse.get(c.courseId) || [];
    const score = scores.length ? round(avg(scores)) : null;
    return { courseId: c.courseId, course: c.course, score, grade: gradeOf(score), progress: c.progress, status: c.status, certificate: c.phases.completion.certificate };
  });
  const myScore = progress.totals.myScore;

  // ── Leaderboard (colleagues in my organization) ───────
  let leaderboard = [];
  let myRank = null, total = 0;
  if (user?.orgId) {
    const summary = await getOrgSummaryReport({ orgId: oid(user.orgId), courseId });
    total = summary.employees.length;
    const rows = summary.employees.map(e => ({
      rank: e.rank, name: e.learnerId === userId ? 'You' : shortName(e.name), isMe: e.learnerId === userId,
      performance: e.performance, progress: e.avgProgress, quizScore: e.quizScore, completed: e.completed, courses: e.courses, certificates: e.certificates,
    }));
    myRank = rows.find(r => r.isMe)?.rank ?? null;
    leaderboard = rows.slice(0, LEADERBOARD_SIZE);
    if (myRank && myRank > LEADERBOARD_SIZE) leaderboard.push(rows.find(r => r.isMe));
  }

  // ── Strong / weak areas ───────────────────────────────
  const quizChapters = progress.chapterRows.filter(c => c.quizzes > 0 && c.bestScore !== null);
  const area = c => ({ course: c.course, chapter: c.chapter, bestScore: c.bestScore, result: c.result, attempts: c.attempts, status: c.status });
  const strong = quizChapters.filter(c => c.result === 'passed' && c.bestScore >= STRONG).sort((a, b) => b.bestScore - a.bestScore).map(area);
  const weak = quizChapters.filter(c => c.result !== 'passed' || c.bestScore < WEAK).sort((a, b) => a.bestScore - b.bestScore).map(area);
  const difficulty = results.byDifficulty.map(d => ({
    difficulty: d.difficulty, avgScore: d.avgScore, skipRate: d.skipRate, shown: d.shown,
    // verdict from the marks on answered questions; heavy skipping is flagged separately
    verdict: d.avgScore === null ? 'untested' : d.avgScore >= STRONG ? 'strong' : d.avgScore < WEAK ? 'weak' : 'ok',
    oftenSkipped: (d.skipRate ?? 0) >= 50,
  }));

  // ── Attempts ──────────────────────────────────────────
  const attempts = tests.map(t => ({
    quiz: t.quiz, course: t.course, chapter: t.chapter, attempts: t.attempts, bestScore: t.bestScore, lastScore: t.lastScore,
    passed: t.passed, passedOnAttempt: t.passedOnAttempt, firstTry: t.passedOnAttempt === 1, lastAt: t.lastAt,
  })).sort((a, b) => b.attempts - a.attempts);
  const passedTests = attempts.filter(a => a.passed);

  // ── Badges (earned / still to earn) ───────────────────
  const aptitudeExpert = progress.aptitude.some(a => a.level === 'expert');
  const badges = [
    { key: 'first-quiz', label: 'First quiz passed', hint: 'Pass any chapter quiz', earned: passedTests.length > 0 },
    { key: 'first-try', label: 'First-try pass', hint: 'Pass a quiz on your first attempt', earned: attempts.some(a => a.firstTry) },
    { key: 'high-score', label: 'High scorer', hint: 'Score 80% or more on a quiz', earned: tests.some(t => t.bestScore >= 80) },
    { key: 'first-course', label: 'Course completed', hint: 'Complete a whole course', earned: certificates.length > 0 },
    { key: 'three-certs', label: 'Certificate collector', hint: 'Earn 3 certificates', earned: certificates.length >= 3 },
    { key: 'expert', label: 'Aptitude expert', hint: 'Reach Expert level in an aptitude test', earned: aptitudeExpert },
    { key: 'top-three', label: 'Top 3', hint: 'Reach the top 3 of the leaderboard', earned: myRank !== null && myRank <= 3 && total > 1 },
  ];

  return {
    filters: { courseId: courseId || null },
    options: progress.options,
    me: { name: user?.name || 'Me' },
    grades: GRADES,
    rules: { STRONG, WEAK, LEADERBOARD_SIZE },
    totals: {
      certificates: certificates.length,
      myScore, grade: gradeOf(myScore),
      myRank, leaderboardSize: total,
      testsPassed: passedTests.length, testsTaken: attempts.length,
      totalAttempts: attempts.reduce((s, a) => s + a.attempts, 0),
      firstTryPasses: attempts.filter(a => a.firstTry).length,
      firstTryRate: pct(attempts.filter(a => a.firstTry).length, attempts.length),
      avgAttemptsToPass: passedTests.length ? Math.round(avg(passedTests.map(a => a.passedOnAttempt)) * 10) / 10 : null,
      badgesEarned: badges.filter(b => b.earned).length, badges: badges.length,
    },
    certificates,
    courseGrades,
    leaderboard,
    strong, weak, difficulty,
    attempts,
    badges,
    generatedAt: new Date(),
  };
}
