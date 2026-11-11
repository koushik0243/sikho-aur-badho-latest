import mongoose from 'mongoose';
import { getOrgProgressReport } from './org_progress_report.service.js';
import { attemptPct } from './trainee_report.service.js';
import { avg } from './report_stats.js';

const { ObjectId } = mongoose.Types;
const oid = (v) => String(v || '');
const round = (n) => Math.round(n);

/**
 * A learner's own progress: overall %, my score, chapters completed / pending,
 * tests passed with marks, current chapter and phase status — per course.
 * @param {{ userId: string, courseId?: string }} filters
 */
export async function getMyProgressReport({ userId, courseId }) {
  const db = mongoose.connection.db;
  const p = await getOrgProgressReport({ learnerId: userId, courseId });

  // Current chapter per course = the first chapter (in course order) not completed yet.
  const chaptersByCourse = new Map();
  p.chapterRows.forEach(c => chaptersByCourse.set(c.courseId, [...(chaptersByCourse.get(c.courseId) || []), c]));
  const courses = p.enrollments.map(e => {
    const list = (chaptersByCourse.get(e.courseId) || []).sort((a, b) => a.order - b.order);
    const current = e.status === 'completed' ? null : list.find(c => c.status !== 'completed') || null;
    return {
      ...e,
      chaptersPending: e.chapters - e.chaptersDone,
      currentChapter: current ? { chapterId: current.chapterId, title: current.chapter, progress: current.progress, status: current.status } : null,
    };
  });

  // ── Tests: best marks per quiz ────────────────────────
  const courseIds = courses.map(c => new ObjectId(c.courseId));
  const attempts = await db.collection('quiz_attempts').find({ userId: new ObjectId(userId), courseId: { $in: courseIds }, status: { $ne: 'pending' } })
    .project({ courseId: 1, chapterId: 1, topicId: 1, totalScore: 1, passed: 1, passingGrade: 1, createdAt: 1, 'answers.maxScore': 1 }).sort({ createdAt: 1 }).toArray();
  const topics = await db.collection('topics').find({ _id: { $in: [...new Set(attempts.map(a => oid(a.topicId)))].map(id => new ObjectId(id)) } }).project({ title: 1, 'quizSettings.passingGrade': 1 }).toArray();
  const quizTitle = new Map(topics.map(t => [oid(t._id), t.title || 'Quiz']));
  // Older attempts didn't save the pass mark — fall back to the quiz's current setting.
  const quizPassMark = new Map(topics.map(t => [oid(t._id), Number(t.quizSettings?.passingGrade) || null]));
  const chapterTitle = new Map(p.chapterRows.map(c => [c.chapterId, { title: c.chapter, order: c.order }]));
  const courseTitle = new Map(courses.map(c => [c.courseId, c.course]));
  const byQuiz = new Map();
  for (const a of attempts) {
    const k = oid(a.topicId);
    const score = round(attemptPct(a));
    const q = byQuiz.get(k) || {
      topicId: k, quiz: quizTitle.get(k) || 'Quiz', courseId: oid(a.courseId), course: courseTitle.get(oid(a.courseId)) || 'Course',
      chapter: chapterTitle.get(oid(a.chapterId))?.title || 'Chapter', chapterOrder: chapterTitle.get(oid(a.chapterId))?.order ?? 0,
      attempts: 0, bestScore: 0, lastScore: 0, passMark: null, passed: false, passedAt: null, passedScore: null, passedOnAttempt: null, lastAt: null,
    };
    q.attempts += 1;
    q.bestScore = Math.max(q.bestScore, score);
    q.lastScore = score;
    q.lastAt = a.createdAt;
    q.passMark = a.passingGrade ?? q.passMark ?? quizPassMark.get(k) ?? null;
    if (a.passed && !q.passed) { q.passed = true; q.passedAt = a.createdAt; q.passedScore = score; q.passedOnAttempt = q.attempts; }
    byQuiz.set(k, q);
  }
  const tests = [...byQuiz.values()].sort((a, b) => a.course.localeCompare(b.course) || a.chapterOrder - b.chapterOrder);

  const overall = courses.length ? round(courses.reduce((s, c) => s + c.progress, 0) / courses.length) : null;
  const aptitude = courses.filter(c => c.phases.aptitude.done).map(c => ({ course: c.course, level: c.phases.aptitude.level, score: c.phases.aptitude.score }));
  const myScore = tests.length ? round(avg(tests.map(t => t.bestScore))) : null;

  return {
    filters: { courseId: courseId || null },
    options: { courses: p.options.courses },
    me: p.options.employees[0] || null,
    phases: p.phases,
    totals: {
      courses: courses.length,
      overall,
      myScore,
      completedCourses: courses.filter(c => c.status === 'completed').length,
      chapters: p.totals.chapters,
      chaptersDone: p.totals.chaptersDone,
      chaptersPending: p.totals.chapters - p.totals.chaptersDone,
      testsPassed: tests.filter(t => t.passed).length,
      testsFailed: tests.filter(t => !t.passed).length,
      certificates: p.totals.certificates,
    },
    courses,
    chapterRows: p.chapterRows,
    tests,
    aptitude,
    generatedAt: new Date(),
  };
}
