import mongoose from 'mongoose';
import { REPORT_TIMEZONE } from './report.service.js';
import { pct, avg, median, dateRange } from './report_stats.js';
import { attemptPct } from './trainee_report.service.js';

const { ObjectId } = mongoose.Types;
const oid = (v) => String(v || '');
const round = (n) => Math.round(n);
const ATTEMPT_LIMIT = 500;

// Letter grade from a score (%). Pass / fail is separate: each quiz has its own pass mark.
export const GRADES = [
  { grade: 'A', min: 90 },
  { grade: 'B', min: 75 },
  { grade: 'C', min: 60 },
  { grade: 'D', min: 40 },
  { grade: 'F', min: 0 },
];
export const gradeOf = (score) => (score === null || score === undefined ? null : GRADES.find(g => score >= g.min).grade);

const skipped = (a) => (a.answers || []).filter(x => x.status === 'skipped').length;

/**
 * Test results for my organization: score, grade, skipped questions, best /
 * worst chapter, time taken, attempts and pass / fail.
 * @param {{ orgId: string, from?: string, to?: string, learnerId?: string, courseId?: string }} filters the period applies to the date taken
 */
export async function getOrgTestResultsReport({ orgId, from, to, learnerId, courseId }) {
  const db = mongoose.connection.db;
  const range = dateRange(from, to);

  const employees = await db.collection('users').find({ orgId: new ObjectId(orgId), user_type: 'employee', deletedAt: null })
    .project({ name: 1, email: 1, emp_id: 1 }).sort({ name: 1 }).toArray();
  const staff = new Map(employees.map(u => [oid(u._id), u]));
  const ids = employees.filter(u => !learnerId || oid(u._id) === learnerId).map(u => u._id);
  const match = { userId: { $in: ids }, status: { $ne: 'pending' } };
  if (range) match.createdAt = range;
  if (courseId) match.courseId = new ObjectId(courseId);

  const [quizAttempts, aptitudeAttempts, courseIdsTaken] = await Promise.all([
    db.collection('quiz_attempts').find(match)
      .project({ userId: 1, courseId: 1, chapterId: 1, topicId: 1, totalScore: 1, passed: 1, passingGrade: 1, timeTakenSec: 1, createdAt: 1, 'answers.status': 1, 'answers.maxScore': 1 })
      .sort({ createdAt: 1 }).toArray(),
    db.collection('aptitude_attempts').find(match)
      .project({ userId: 1, courseId: 1, totalScore: 1, level: 1, timeTakenSec: 1, createdAt: 1, 'answers.status': 1, 'answers.maxScore': 1 })
      .sort({ createdAt: -1 }).toArray(),
    db.collection('quiz_attempts').distinct('courseId', { userId: { $in: employees.map(u => u._id) } }),
  ]);

  const courseIdSet = [...new Set([...quizAttempts, ...aptitudeAttempts].map(a => oid(a.courseId)).concat(courseIdsTaken.map(oid)))].filter(Boolean);
  const [courses, chapters, topics] = await Promise.all([
    db.collection('courses').find({ _id: { $in: courseIdSet.map(id => new ObjectId(id)) } }).project({ title: 1, deletedAt: 1, status: 1 }).toArray(),
    db.collection('chapters').find({ courseId: { $in: courseIdSet.map(id => new ObjectId(id)) } }).project({ title: 1, order: 1 }).toArray(),
    db.collection('topics').find({ _id: { $in: [...new Set(quizAttempts.map(a => oid(a.topicId)))].map(id => new ObjectId(id)) } }).project({ title: 1 }).toArray(),
  ]);
  const courseTitle = new Map(courses.map(c => [oid(c._id), `${c.title || 'Untitled course'}${c.deletedAt || c.status === 'deleted' ? ' (deleted)' : ''}`]));
  const chapterInfo = new Map(chapters.map(c => [oid(c._id), { title: c.title || 'Untitled chapter', order: c.order ?? 0 }]));
  const quizTitle = new Map(topics.map(t => [oid(t._id), t.title || 'Quiz']));
  const nameOf = id => staff.get(id)?.name || staff.get(id)?.email || 'Employee';

  // ── Attempt log ───────────────────────────────────────
  const attemptNo = new Map();
  const attempts = quizAttempts.map(a => {
    const k = `${a.userId}|${a.topicId}`;
    attemptNo.set(k, (attemptNo.get(k) || 0) + 1);
    const score = round(attemptPct(a));
    const total = (a.answers || []).length;
    return {
      learnerId: oid(a.userId), name: nameOf(oid(a.userId)), email: staff.get(oid(a.userId))?.email || null,
      courseId: oid(a.courseId), course: courseTitle.get(oid(a.courseId)) || 'Deleted course',
      chapterId: oid(a.chapterId), chapter: chapterInfo.get(oid(a.chapterId))?.title || 'Deleted chapter', chapterOrder: chapterInfo.get(oid(a.chapterId))?.order ?? 0,
      topicId: oid(a.topicId), quiz: quizTitle.get(oid(a.topicId)) || 'Quiz',
      attempt: attemptNo.get(k), takenAt: a.createdAt,
      score, grade: gradeOf(score), passMark: a.passingGrade ?? null, passed: Boolean(a.passed),
      questions: total, skipped: skipped(a), timeTakenSec: a.timeTakenSec ?? null,
    };
  });

  // Best attempt per employee + quiz (what the grade / chapter ranking use).
  const bestByQuiz = new Map();
  for (const a of attempts) {
    const k = `${a.learnerId}|${a.topicId}`;
    const cur = bestByQuiz.get(k);
    if (!cur || a.score > cur.score) bestByQuiz.set(k, { ...a, attempts: 0, passedEver: false });
  }
  for (const a of attempts) {
    const b = bestByQuiz.get(`${a.learnerId}|${a.topicId}`);
    b.attempts += 1;
    b.passedEver = b.passedEver || a.passed;
  }
  const best = [...bestByQuiz.values()];
  const times = list => list.map(a => a.timeTakenSec).filter(v => v !== null);

  // ── Per employee ──────────────────────────────────────
  const perEmployee = [...new Set(attempts.map(a => a.learnerId))].map(id => {
    const mine = attempts.filter(a => a.learnerId === id);
    const mineBest = best.filter(b => b.learnerId === id);
    const byChapter = new Map();
    mineBest.forEach(b => { const k = `${b.courseId}|${b.chapterId}`; byChapter.set(k, [...(byChapter.get(k) || []), b]); });
    const chapterScores = [...byChapter.values()].map(list => ({ chapter: list[0].chapter, course: list[0].course, score: round(list.reduce((s, b) => s + b.score, 0) / list.length) }))
      .sort((x, y) => y.score - x.score);
    const avgScore = avg(mineBest.map(b => b.score));
    const questions = mine.reduce((s, a) => s + a.questions, 0), skippedQs = mine.reduce((s, a) => s + a.skipped, 0);
    return {
      learnerId: id, name: nameOf(id), email: staff.get(id)?.email || null, empId: staff.get(id)?.emp_id || null,
      quizzes: mineBest.length, attempts: mine.length,
      passed: mineBest.filter(b => b.passedEver).length, failed: mineBest.filter(b => !b.passedEver).length,
      attemptsPassed: mine.filter(a => a.passed).length, attemptsFailed: mine.filter(a => !a.passed).length,
      avgScore, grade: gradeOf(avgScore),
      bestScore: Math.max(...mine.map(a => a.score)), worstScore: Math.min(...mine.map(a => a.score)),
      questions, skipped: skippedQs, skipRate: pct(skippedQs, questions),
      avgTimeSec: avg(times(mine)), timedAttempts: times(mine).length,
      bestChapter: chapterScores.length ? chapterScores[0] : null,
      worstChapter: chapterScores.length > 1 ? chapterScores[chapterScores.length - 1] : null,
    };
  }).sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1) || a.name.localeCompare(b.name));

  // ── Per chapter (organization) ────────────────────────
  const chapterMap = new Map();
  for (const b of best) {
    const k = `${b.courseId}|${b.chapterId}`;
    const c = chapterMap.get(k) || { courseId: b.courseId, course: b.course, chapterId: b.chapterId, chapter: b.chapter, order: b.chapterOrder, scores: [], passed: 0, takers: new Set() };
    c.scores.push(b.score);
    c.takers.add(b.learnerId);
    if (b.passedEver) c.passed += 1;
    chapterMap.set(k, c);
  }
  const chapterRows = [...chapterMap.values()].map(c => {
    const list = attempts.filter(a => a.courseId === c.courseId && a.chapterId === c.chapterId);
    const qs = list.reduce((s, a) => s + a.questions, 0), sk = list.reduce((s, a) => s + a.skipped, 0);
    const avgScore = avg(c.scores);
    return {
      courseId: c.courseId, course: c.course, chapterId: c.chapterId, chapter: c.chapter, order: c.order,
      employees: c.takers.size, attempts: list.length, avgScore, grade: gradeOf(avgScore),
      passRate: pct(c.passed, c.scores.length), skipRate: pct(sk, qs), avgTimeSec: avg(times(list)),
    };
  }).sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1) || a.course.localeCompare(b.course) || a.order - b.order);

  // ── Aptitude tests ────────────────────────────────────
  const aptitude = aptitudeAttempts.map(a => {
    const score = round(attemptPct(a));
    return {
      learnerId: oid(a.userId), name: nameOf(oid(a.userId)), email: staff.get(oid(a.userId))?.email || null,
      course: courseTitle.get(oid(a.courseId)) || 'Deleted course', takenAt: a.createdAt,
      score, grade: gradeOf(score), level: a.level || null,
      questions: (a.answers || []).length, skipped: skipped(a), timeTakenSec: a.timeTakenSec ?? null,
    };
  });

  const allQs = attempts.reduce((s, a) => s + a.questions, 0), allSkipped = attempts.reduce((s, a) => s + a.skipped, 0);
  const gradeCounts = Object.fromEntries(GRADES.map(g => [g.grade, best.filter(b => b.grade === g.grade).length]));
  const sortedLog = [...attempts].sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt));
  const courseOptions = courseIdsTaken.map(oid).filter(id => courseTitle.has(id)).map(id => ({ id, title: courseTitle.get(id) })).sort((a, b) => a.title.localeCompare(b.title));

  return {
    period: { from: from || null, to: to || null, timezone: REPORT_TIMEZONE },
    filters: { learnerId: learnerId || null, courseId: courseId || null },
    options: { employees: employees.map(u => ({ id: oid(u._id), name: u.name || u.email || 'Employee' })), courses: courseOptions },
    grades: GRADES,
    totals: {
      employees: perEmployee.length,
      quizzes: best.length,
      attempts: attempts.length,
      attemptsPassed: attempts.filter(a => a.passed).length,
      attemptsFailed: attempts.filter(a => !a.passed).length,
      passRate: pct(attempts.filter(a => a.passed).length, attempts.length),
      quizzesPassed: best.filter(b => b.passedEver).length,
      quizzesFailed: best.filter(b => !b.passedEver).length,
      avgScore: avg(best.map(b => b.score)),
      medianScore: median(best.map(b => b.score)),
      grade: gradeOf(avg(best.map(b => b.score))),
      questions: allQs, skipped: allSkipped, skipRate: pct(allSkipped, allQs),
      avgTimeSec: avg(times(attempts)), timedAttempts: times(attempts).length,
      aptitudeTests: aptitude.length,
    },
    gradeCounts,
    bestChapter: chapterRows[0] || null,
    worstChapter: chapterRows.length > 1 ? chapterRows[chapterRows.length - 1] : null,
    perEmployee,
    chapterRows,
    attempts: sortedLog.slice(0, ATTEMPT_LIMIT),
    attemptLimit: ATTEMPT_LIMIT,
    aptitude,
    generatedAt: new Date(),
  };
}
