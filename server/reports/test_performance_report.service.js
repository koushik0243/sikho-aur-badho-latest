import { ACTIVITY_COUNTS_FILTER } from '../topic_activity/topic_activity.model.js';
import mongoose from 'mongoose';
import { REPORT_TIMEZONE } from './report.service.js';
import { pct, avg, median, scorePct, dateRange, inRange } from './report_stats.js';
import { loadEnrollments } from './trainee_report.service.js';

const { ObjectId } = mongoose.Types;
const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_SKIPPED = 10;
const COMPLETION_LIST_LIMIT = 100;

/**
 * Test performance: quiz pass/fail, chapter-wise marks, question skip rate,
 * aptitude test results, homework done, Zoom sessions joined and course
 * completion time.
 * @param {{ from?: string, to?: string, orgId?: string, courseId?: string }} filters
 *   the period applies to quiz / aptitude attempts and to completion dates
 */
export async function getTestPerformanceReport({ from, to, orgId, courseId } = {}) {
  const db = mongoose.connection.db;
  const range = dateRange(from, to);

  // Learners in scope (one organization's learners, or everyone).
  let learnerFilter = null;
  if (orgId) {
    learnerFilter = (await db.collection('users').find({ orgId: new ObjectId(orgId), user_type: 'employee' }).project({ _id: 1 }).toArray()).map(u => u._id);
  }
  const attemptMatch = {};
  if (range) attemptMatch.createdAt = range;
  if (courseId) attemptMatch.courseId = new ObjectId(courseId);
  if (learnerFilter) attemptMatch.userId = { $in: learnerFilter };

  const [quizAttempts, aptitudeAttempts, enrollment] = await Promise.all([
    db.collection('quiz_attempts').find(attemptMatch)
      .project({ userId: 1, courseId: 1, chapterId: 1, topicId: 1, totalScore: 1, passed: 1, status: 1, createdAt: 1, 'answers.questionId': 1, 'answers.questionText': 1, 'answers.status': 1, 'answers.maxScore': 1 }).toArray(),
    db.collection('aptitude_attempts').find(attemptMatch)
      .project({ userId: 1, courseId: 1, totalScore: 1, level: 1, status: 1, createdAt: 1, 'answers.status': 1, 'answers.maxScore': 1 }).toArray(),
    loadEnrollments({ orgId, courseId }), // all enrollments (any date) for homework / Zoom / completion time
  ]);

  // Names for every course / chapter referenced.
  const courseIds = [...new Set([...quizAttempts, ...aptitudeAttempts].map(a => String(a.courseId)).concat(enrollment.rows.map(r => r.courseId)))]
    .filter(Boolean).map(id => new ObjectId(id));
  const [courses, chapters] = await Promise.all([
    db.collection('courses').find({ _id: { $in: courseIds } }).project({ title: 1 }).toArray(),
    db.collection('chapters').find({ courseId: { $in: courseIds } }).project({ title: 1, order: 1, courseId: 1 }).toArray(),
  ]);
  const courseTitle = new Map(courses.map(c => [String(c._id), c.title || 'Untitled course']));
  const chapterInfo = new Map(chapters.map(c => [String(c._id), { title: c.title || 'Untitled chapter', order: c.order ?? 0 }]));

  // ── Quizzes: pass / fail ──────────────────────────────
  const evaluated = quizAttempts.filter(a => a.status !== 'pending');
  const passedAttempts = evaluated.filter(a => a.passed).length;
  // per learner + quiz: passed at least once, or only failed
  const outcome = new Map();
  for (const a of evaluated) {
    const k = `${a.userId}|${a.topicId}`;
    outcome.set(k, outcome.get(k) || Boolean(a.passed));
  }
  const learnerQuizPassed = [...outcome.values()].filter(Boolean).length;

  // ── Question skip rate ────────────────────────────────
  let answersShown = 0, answersSkipped = 0;
  const questions = new Map();
  for (const a of quizAttempts) {
    for (const ans of a.answers || []) {
      answersShown += 1;
      const skipped = ans.status === 'skipped';
      if (skipped) answersSkipped += 1;
      const q = questions.get(String(ans.questionId)) || { text: ans.questionText || 'Question', courseId: String(a.courseId), chapterId: String(a.chapterId), shown: 0, skipped: 0 };
      q.shown += 1;
      if (skipped) q.skipped += 1;
      questions.set(String(ans.questionId), q);
    }
  }
  const mostSkipped = [...questions.values()]
    .filter(q => q.skipped > 0)
    .map(q => ({ question: q.text, course: courseTitle.get(q.courseId) || 'Deleted course', chapter: chapterInfo.get(q.chapterId)?.title || '—', shown: q.shown, skipped: q.skipped, skipRate: pct(q.skipped, q.shown) }))
    .sort((a, b) => b.skipRate - a.skipRate || b.skipped - a.skipped)
    .slice(0, TOP_SKIPPED);

  // ── Chapter-wise marks ────────────────────────────────
  const byChapter = new Map();
  for (const a of quizAttempts) {
    const k = `${a.courseId}|${a.chapterId}`;
    const c = byChapter.get(k) || { courseId: String(a.courseId), chapterId: String(a.chapterId), attempts: 0, evaluated: 0, passed: 0, scores: [], best: new Map(), shown: 0, skipped: 0 };
    c.attempts += 1;
    if (a.status !== 'pending') {
      c.evaluated += 1;
      if (a.passed) c.passed += 1;
      const score = scorePct(a);
      c.scores.push(score);
      c.best.set(String(a.userId), Math.max(c.best.get(String(a.userId)) ?? 0, score));
    }
    for (const ans of a.answers || []) { c.shown += 1; if (ans.status === 'skipped') c.skipped += 1; }
    byChapter.set(k, c);
  }
  const chapterMarks = [...byChapter.values()].map(c => ({
    course: courseTitle.get(c.courseId) || 'Deleted course',
    chapter: chapterInfo.get(c.chapterId)?.title || 'Deleted chapter',
    order: chapterInfo.get(c.chapterId)?.order ?? 0,
    chapterId: c.chapterId,
    attempts: c.attempts,
    learners: c.best.size,
    avgScore: avg(c.scores),
    avgBest: avg([...c.best.values()]),
    passRate: pct(c.passed, c.evaluated),
    skipRate: pct(c.skipped, c.shown),
  })).sort((a, b) => a.course.localeCompare(b.course) || a.order - b.order);

  // ── Aptitude test results ─────────────────────────────
  const aptEvaluated = aptitudeAttempts.filter(a => a.status !== 'pending');
  const levels = { beginner: 0, intermediate: 0, expert: 0 };
  aptEvaluated.forEach(a => { if (levels[a.level] !== undefined) levels[a.level] += 1; });
  let aptShown = 0, aptSkipped = 0;
  aptitudeAttempts.forEach(a => (a.answers || []).forEach(x => { aptShown += 1; if (x.status === 'skipped') aptSkipped += 1; }));
  const aptByCourse = new Map();
  for (const a of aptitudeAttempts) {
    const c = aptByCourse.get(String(a.courseId)) || { courseId: String(a.courseId), attempts: 0, learners: new Set(), scores: [], beginner: 0, intermediate: 0, expert: 0 };
    c.attempts += 1;
    c.learners.add(String(a.userId));
    if (a.status !== 'pending') {
      c.scores.push(scorePct(a));
      if (c[a.level] !== undefined) c[a.level] += 1;
    }
    aptByCourse.set(String(a.courseId), c);
  }

  // ── Homework + Zoom (current status for enrolled learners) ──
  const enrolledByCourse = new Map();
  for (const r of enrollment.rows) {
    const set = enrolledByCourse.get(r.courseId) || new Set();
    set.add(r.learnerId);
    enrolledByCourse.set(r.courseId, set);
  }
  const scopeCourses = [...enrolledByCourse.keys()].map(id => new ObjectId(id));
  const liveChapterIds = enrollment.chapters.map(c => c._id);
  const [activityTopics, activities] = await Promise.all([
    db.collection('topics').find({ courseId: { $in: scopeCourses }, chapterId: { $in: liveChapterIds }, deletedAt: null, video_type: { $in: ['assignment', 'zoom_link'] } })
      .project({ courseId: 1, chapterId: 1, title: 1, video_type: 1, zoom_time: 1, scheduled_at: 1, start_time: 1, order: 1 }).toArray(),
    db.collection('topic_activities').find({ courseId: { $in: scopeCourses }, ...ACTIVITY_COUNTS_FILTER }).project({ userId: 1, topicId: 1, type: 1 }).toArray(),
  ]);
  const doneBy = new Map(); // `${type}|${topicId}` → Set(userId)
  for (const x of activities) {
    const k = `${x.type}|${x.topicId}`;
    const set = doneBy.get(k) || new Set();
    set.add(String(x.userId));
    doneBy.set(k, set);
  }
  const topicRows = (videoType, type) => activityTopics
    .filter(t => t.video_type === videoType)
    .map(t => {
      const enrolled = enrolledByCourse.get(String(t.courseId)) || new Set();
      const done = [...(doneBy.get(`${type}|${t._id}`) || [])].filter(u => enrolled.has(u)).length;
      return {
        topicId: String(t._id),
        course: courseTitle.get(String(t.courseId)) || 'Deleted course',
        chapter: chapterInfo.get(String(t.chapterId))?.title || '—',
        chapterOrder: chapterInfo.get(String(t.chapterId))?.order ?? 0,
        title: t.title || 'Untitled',
        scheduledAt: t.zoom_time || t.scheduled_at || t.start_time || null,
        enrolled: enrolled.size,
        done,
        notDone: enrolled.size - done,
        rate: pct(done, enrolled.size),
      };
    })
    .sort((a, b) => a.course.localeCompare(b.course) || a.chapterOrder - b.chapterOrder || a.title.localeCompare(b.title));
  const homework = topicRows('assignment', 'assignment_done');
  const zoom = topicRows('zoom_link', 'zoom_joined');
  const sumOf = (rows, f) => rows.reduce((s, r) => s + r[f], 0);

  // ── Course completion time ────────────────────────────
  const completions = enrollment.rows
    .filter(r => r.status === 'completed' && r.completedAt && inRange(new Date(r.completedAt), range))
    .map(r => ({
      name: r.name, email: r.email, organization: r.organization, course: r.course, courseId: r.courseId,
      enrolledAt: r.enrolledAt, completedAt: r.completedAt,
      days: Math.max(0, Math.round(((new Date(r.completedAt) - new Date(r.enrolledAt)) / DAY_MS) * 10) / 10),
    }))
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  const days = completions.map(c => c.days);
  const completionByCourse = new Map();
  for (const c of completions) {
    const list = completionByCourse.get(c.courseId) || [];
    list.push(c.days);
    completionByCourse.set(c.courseId, list);
  }

  return {
    period: { from: from || null, to: to || null, timezone: REPORT_TIMEZONE },
    quiz: {
      attempts: quizAttempts.length,
      evaluated: evaluated.length,
      pendingEvaluation: quizAttempts.length - evaluated.length,
      passed: passedAttempts,
      failed: evaluated.length - passedAttempts,
      passRate: pct(passedAttempts, evaluated.length),
      avgScore: avg(evaluated.map(scorePct)),
      learnerQuizzes: outcome.size,
      learnerQuizPassed,
      learnerQuizFailed: outcome.size - learnerQuizPassed,
    },
    chapterMarks,
    skip: { shown: answersShown, skipped: answersSkipped, rate: pct(answersSkipped, answersShown), mostSkipped },
    aptitude: {
      attempts: aptitudeAttempts.length,
      learners: new Set(aptitudeAttempts.map(a => String(a.userId))).size,
      avgScore: avg(aptEvaluated.map(scorePct)),
      skipRate: pct(aptSkipped, aptShown),
      levels,
      byCourse: [...aptByCourse.values()].map(c => ({
        course: courseTitle.get(c.courseId) || 'Deleted course',
        attempts: c.attempts, learners: c.learners.size, avgScore: avg(c.scores),
        beginner: c.beginner, intermediate: c.intermediate, expert: c.expert,
      })).sort((a, b) => b.attempts - a.attempts),
    },
    homework: { rows: homework, enrolled: sumOf(homework, 'enrolled'), done: sumOf(homework, 'done'), rate: pct(sumOf(homework, 'done'), sumOf(homework, 'enrolled')) },
    zoom: { rows: zoom, enrolled: sumOf(zoom, 'enrolled'), joined: sumOf(zoom, 'done'), rate: pct(sumOf(zoom, 'done'), sumOf(zoom, 'enrolled')) },
    completion: {
      count: completions.length,
      avgDays: avg(days),
      medianDays: median(days),
      fastestDays: days.length ? Math.min(...days) : null,
      slowestDays: days.length ? Math.max(...days) : null,
      byCourse: [...completionByCourse.entries()].map(([cid, list]) => ({
        course: courseTitle.get(cid) || 'Deleted course', completions: list.length,
        avgDays: avg(list), fastestDays: Math.min(...list), slowestDays: Math.max(...list),
      })).sort((a, b) => b.completions - a.completions),
      list: completions.slice(0, COMPLETION_LIST_LIMIT),
      listLimit: COMPLETION_LIST_LIMIT,
    },
    generatedAt: new Date(),
  };
}
