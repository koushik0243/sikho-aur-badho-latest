import { ACTIVITY_COUNTS_FILTER } from '../topic_activity/topic_activity.model.js';
import mongoose from 'mongoose';
import { loadEnrollments, topicKind, attemptPct } from './trainee_report.service.js';
import { pct, avg } from './report_stats.js';

const { ObjectId } = mongoose.Types;
const oid = (v) => String(v || '');
const round = (n) => Math.round(n);

// The stages a learner goes through in a course, in order.
export const PHASES = [
  { key: 'aptitude', label: 'Aptitude test' },
  { key: 'lessons', label: 'Lessons' },
  { key: 'quizzes', label: 'Chapter quizzes' },
  { key: 'activities', label: 'Homework & Zoom' },
  { key: 'completion', label: 'Completion & certificate' },
];

/** done / total → 'done' | 'in_progress' | 'not_started' | 'none' (nothing to do). */
const phaseStatus = (done, total, started = done > 0) => (total === 0 ? 'none' : done >= total ? 'done' : started ? 'in_progress' : 'not_started');

/**
 * Chapter-wise and phase-wise progress per employee (enrollment), with results.
 * @param {{ orgId?: string, learnerId?: string, courseId?: string }} filters
 *   orgId = an organization's employees (store owner); no orgId = just learnerId (the learner's own report)
 */
export async function getOrgProgressReport({ orgId, learnerId, courseId }) {
  const db = mongoose.connection.db;
  const people = orgId
    ? { orgId: new ObjectId(orgId), user_type: 'employee', deletedAt: null }
    : { _id: new ObjectId(learnerId), deletedAt: null };

  const [employees, enrollment] = await Promise.all([
    db.collection('users').find(people).project({ name: 1, email: 1, emp_id: 1 }).sort({ name: 1 }).toArray(),
    orgId ? loadEnrollments({ orgId, courseId }) : loadEnrollments({ courseId, userId: learnerId }),
  ]);
  const staff = new Map(employees.map(u => [oid(u._id), u]));
  const allRows = enrollment.rows.filter(r => staff.has(r.learnerId));
  const rows = allRows.filter(r => !learnerId || r.learnerId === learnerId);

  const userIds = [...new Set(rows.map(r => r.learnerId))].map(id => new ObjectId(id));
  const courseIds = [...new Set(rows.map(r => r.courseId))].map(id => new ObjectId(id));
  const [courses, chapters, topics, progress, attempts, activities, aptitude, certificates] = await Promise.all([
    db.collection('courses').find({ _id: { $in: courseIds } }).project({ title: 1, aptitudeEnabled: 1, deletedAt: 1, status: 1 }).toArray(),
    db.collection('chapters').find({ courseId: { $in: courseIds }, deletedAt: null, status: { $ne: 'inactive' } }).project({ courseId: 1, title: 1, order: 1 }).sort({ order: 1 }).toArray(),
    db.collection('topics').find({ courseId: { $in: courseIds }, deletedAt: null }).project({ courseId: 1, chapterId: 1, video_type: 1, videoUrl: 1 }).toArray(),
    db.collection('progresses').find({ userId: { $in: userIds }, courseId: { $in: courseIds } }).project({ userId: 1, topicId: 1, completed: 1 }).toArray(),
    db.collection('quiz_attempts').find({ userId: { $in: userIds }, courseId: { $in: courseIds }, status: { $ne: 'pending' } })
      .project({ userId: 1, topicId: 1, passed: 1, totalScore: 1, 'answers.maxScore': 1 }).toArray(),
    db.collection('topic_activities').find({ userId: { $in: userIds }, courseId: { $in: courseIds }, ...ACTIVITY_COUNTS_FILTER }).project({ userId: 1, topicId: 1 }).toArray(),
    db.collection('aptitude_attempts').find({ userId: { $in: userIds }, courseId: { $in: courseIds }, status: { $ne: 'pending' } })
      .project({ userId: 1, courseId: 1, level: 1, totalScore: 1, createdAt: 1, 'answers.maxScore': 1 }).sort({ createdAt: -1 }).toArray(),
    db.collection('course_completions').find({ userId: { $in: userIds }, courseId: { $in: courseIds } }).project({ userId: 1, courseId: 1 }).toArray(),
  ]);

  const courseInfo = new Map(courses.map(c => [oid(c._id), c]));
  const chaptersOf = new Map();
  chapters.forEach(c => { const k = oid(c.courseId); chaptersOf.set(k, [...(chaptersOf.get(k) || []), c]); });
  const topicsOf = new Map(); // chapterId → { lessons, quizzes, homework, zoom } (topic id lists)
  for (const t of topics) {
    const k = oid(t.chapterId);
    const g = topicsOf.get(k) || { lessons: [], quizzes: [], homework: [], zoom: [] };
    const kind = topicKind(t);
    if (kind === 'lesson' && t.videoUrl) g.lessons.push(oid(t._id));
    else if (kind === 'quiz') g.quizzes.push(oid(t._id));
    else if (kind === 'assignment') g.homework.push(oid(t._id));
    else if (kind === 'zoom') g.zoom.push(oid(t._id));
    topicsOf.set(k, g);
  }
  // per learner: watched lessons, activity topics, quiz best / passed / attempts
  const watched = new Set(progress.filter(p => p.completed).map(p => `${p.userId}|${p.topicId}`));
  const touched = new Set(progress.map(p => `${p.userId}|${p.topicId}`));
  const acted = new Set(activities.map(a => `${a.userId}|${a.topicId}`));
  const quiz = new Map();
  for (const a of attempts) {
    const k = `${a.userId}|${a.topicId}`;
    const q = quiz.get(k) || { attempts: 0, passed: false, best: 0 };
    q.attempts += 1;
    q.passed = q.passed || Boolean(a.passed);
    q.best = Math.max(q.best, attemptPct(a));
    quiz.set(k, q);
  }
  const latestAptitude = new Map();
  aptitude.forEach(a => { const k = `${a.userId}|${a.courseId}`; if (!latestAptitude.has(k)) latestAptitude.set(k, a); });
  const certified = new Set(certificates.map(c => `${c.userId}|${c.courseId}`));

  // ── Per enrollment ────────────────────────────────────
  const chapterRows = [];
  const enrollments = rows.map(r => {
    const u = r.learnerId;
    const info = courseInfo.get(r.courseId);
    const has = (id) => watched.has(`${u}|${id}`);
    const totals = { lessons: 0, watched: 0, quizzes: 0, passed: 0, failed: 0, activities: 0, activitiesDone: 0, chapters: 0, chaptersDone: 0, bestScores: [] };
    for (const ch of chaptersOf.get(r.courseId) || []) {
      const g = topicsOf.get(oid(ch._id)) || { lessons: [], quizzes: [], homework: [], zoom: [] };
      const lessonsDone = g.lessons.filter(has).length;
      const qs = g.quizzes.map(id => quiz.get(`${u}|${id}`));
      const quizPassed = qs.filter(q => q?.passed).length;
      const quizFailed = qs.filter(q => q && !q.passed).length;
      const best = qs.filter(Boolean).map(q => q.best);
      const homeworkDone = g.homework.filter(id => acted.has(`${u}|${id}`)).length;
      const zoomDone = g.zoom.filter(id => acted.has(`${u}|${id}`)).length;
      const required = g.lessons.length + g.quizzes.length;
      const started = lessonsDone > 0 || qs.some(Boolean) || homeworkDone + zoomDone > 0 || g.lessons.some(id => touched.has(`${u}|${id}`));
      const extras = g.homework.length + g.zoom.length;
      // Done = every lesson watched and every quiz passed. A chapter with only homework / Zoom
      // is done when those are, or when the whole course has been completed.
      const finished = required > 0
        ? lessonsDone === g.lessons.length && quizPassed === g.quizzes.length
        : (extras > 0 && homeworkDone + zoomDone === extras) || r.status === 'completed';
      const status = finished ? 'completed' : started ? 'in_progress' : 'not_started';
      const result = g.quizzes.length === 0 ? 'no_quiz' : quizPassed === g.quizzes.length ? 'passed' : quizFailed > 0 ? 'failed' : 'not_taken';
      chapterRows.push({
        learnerId: u, name: r.name, email: r.email, courseId: r.courseId, course: r.course,
        chapterId: oid(ch._id), chapter: ch.title || 'Untitled chapter', order: ch.order ?? 0,
        lessons: g.lessons.length, lessonsDone,
        quizzes: g.quizzes.length, quizPassed, quizFailed,
        attempts: qs.reduce((s, q) => s + (q?.attempts || 0), 0),
        bestScore: best.length ? round(Math.max(...best)) : null,
        homework: g.homework.length, homeworkDone, zoom: g.zoom.length, zoomDone,
        progress: required ? round(((lessonsDone + quizPassed) / required) * 100) : (finished ? 100 : extras ? round(((homeworkDone + zoomDone) / extras) * 100) : 0),
        status, result,
      });
      totals.chapters += 1;
      totals.chaptersDone += status === 'completed' ? 1 : 0;
      totals.lessons += g.lessons.length; totals.watched += lessonsDone;
      totals.quizzes += g.quizzes.length; totals.passed += quizPassed; totals.failed += quizFailed;
      totals.activities += g.homework.length + g.zoom.length; totals.activitiesDone += homeworkDone + zoomDone;
      totals.bestScores.push(...best);
    }
    const apt = latestAptitude.get(`${u}|${r.courseId}`);
    const aptitudeRequired = Boolean(info?.aptitudeEnabled);
    const completed = r.status === 'completed';
    const phases = {
      aptitude: { done: apt ? 1 : 0, total: aptitudeRequired || apt ? 1 : 0, status: phaseStatus(apt ? 1 : 0, aptitudeRequired || apt ? 1 : 0), level: apt?.level || null, score: apt ? round(attemptPct(apt)) : null },
      lessons: { done: totals.watched, total: totals.lessons, status: phaseStatus(totals.watched, totals.lessons) },
      quizzes: { done: totals.passed, total: totals.quizzes, failed: totals.failed, status: phaseStatus(totals.passed, totals.quizzes, totals.passed + totals.failed > 0) },
      activities: { done: totals.activitiesDone, total: totals.activities, status: phaseStatus(totals.activitiesDone, totals.activities) },
      completion: { done: completed ? 1 : 0, total: 1, status: completed ? 'done' : (totals.watched + totals.passed > 0 ? 'in_progress' : 'not_started'), certificate: certified.has(`${u}|${r.courseId}`) },
    };
    return {
      learnerId: u, name: r.name, email: r.email, empId: staff.get(u)?.emp_id || null,
      courseId: r.courseId, course: r.course + (info?.deletedAt || info?.status === 'deleted' ? ' (deleted)' : ''),
      enrolledAt: r.enrolledAt, progress: r.progress, status: r.status, completedAt: r.completedAt,
      chapters: totals.chapters, chaptersDone: totals.chaptersDone,
      quizPassed: totals.passed, quizFailed: totals.failed, quizzes: totals.quizzes,
      avgBestScore: avg(totals.bestScores.map(round)),
      phases,
    };
  }).sort((a, b) => a.name.localeCompare(b.name) || a.course.localeCompare(b.course));
  chapterRows.sort((a, b) => a.name.localeCompare(b.name) || a.course.localeCompare(b.course) || a.order - b.order);

  // ── Phase summary across the enrollments shown ────────
  const phaseSummary = PHASES.map(p => {
    const list = enrollments.map(e => e.phases[p.key]).filter(x => x.status !== 'none');
    const done = list.reduce((s, x) => s + x.done, 0), total = list.reduce((s, x) => s + x.total, 0);
    return {
      ...p,
      applicable: list.length,
      finished: list.filter(x => x.status === 'done').length,
      inProgress: list.filter(x => x.status === 'in_progress').length,
      notStarted: list.filter(x => x.status === 'not_started').length,
      done, total, rate: pct(done, total),
    };
  });

  // Every course this organization's employees are enrolled in (for the filter), whatever is selected.
  const orgCourseIds = await db.collection('course_assignments').distinct('courseId', {
    ...(orgId ? { organizationId: new ObjectId(orgId) } : {}),
    userId: { $in: employees.map(e => e._id) },
  });
  const optionCourses = await db.collection('courses').find({ _id: { $in: orgCourseIds } }).project({ title: 1, deletedAt: 1, status: 1 }).toArray();
  const courseOptions = optionCourses.map(c => ({ id: oid(c._id), title: `${c.title || 'Untitled course'}${c.deletedAt || c.status === 'deleted' ? ' (deleted)' : ''}` }))
    .sort((a, b) => a.title.localeCompare(b.title));
  return {
    filters: { learnerId: learnerId || null, courseId: courseId || null },
    options: {
      employees: employees.map(u => ({ id: oid(u._id), name: u.name || u.email || 'Employee', email: u.email || null })),
      courses: courseOptions,
    },
    phases: PHASES,
    totals: {
      employees: new Set(enrollments.map(e => e.learnerId)).size,
      enrollments: enrollments.length,
      avgProgress: enrollments.length ? round(enrollments.reduce((s, e) => s + e.progress, 0) / enrollments.length) : null,
      chapters: chapterRows.length,
      chaptersDone: chapterRows.filter(c => c.status === 'completed').length,
      quizPassed: enrollments.reduce((s, e) => s + e.quizPassed, 0),
      quizFailed: enrollments.reduce((s, e) => s + e.quizFailed, 0),
      completed: enrollments.filter(e => e.status === 'completed').length,
      certificates: enrollments.filter(e => e.phases.completion.certificate).length,
    },
    phaseSummary,
    enrollments,
    chapterRows,
    generatedAt: new Date(),
  };
}
