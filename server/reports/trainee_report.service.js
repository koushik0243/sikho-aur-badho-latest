import mongoose from 'mongoose';
import { REPORT_TIMEZONE, startOfDayIST } from './report.service.js';

const { ObjectId } = mongoose.Types;

// An enrollment = one course assigned to one learner (course_assignments).
// Not completed + no learning activity (lesson watched / quiz taken) for this
// many days = dropout; with activity in that window = in progress; never
// started but assigned within it = not started.
export const DROPOUT_DAYS = 30;
const TRAINEE_LIMIT = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

const monthKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIMEZONE, year: 'numeric', month: '2-digit' })
  .format(date).slice(0, 7);
function monthsBetween(first, last) {
  const out = [];
  let [y, m] = first.split('-').map(Number);
  const [ly, lm] = last.split('-').map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}
const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
export const topicKind = (t) => {
  const vt = String(t.video_type || '').toLowerCase().trim();
  if (vt === 'zoom_link') return 'zoom';
  if (vt === 'quiz' || vt === 'assignment') return vt;
  return 'lesson';
};
// An attempt's score in %: totalScore out of the answers' max marks.
export const attemptPct = (a) => {
  const max = (a.answers || []).reduce((s, x) => s + (Number(x.maxScore) || 0), 0);
  const score = Number(a.totalScore) || 0;
  return max > 0 ? Math.min(100, (score / max) * 100) : score;
};

/**
 * Enrollments (optionally assigned in a period / one organization / one course)
 * with each one's completion status, progress and last activity — shared by the
 * Trainee and Test Performance reports.
 * @param {{ from?: string, to?: string, orgId?: string, courseId?: string, userId?: string }} filters
 */
export async function loadEnrollments({ from, to, orgId, courseId, userId } = {}) {
  const db = mongoose.connection.db;
  const now = Date.now();

  // ── Enrollments ───────────────────────────────────────
  const match = {};
  if (from || to) {
    match.attemptedAt = {};
    if (from) match.attemptedAt.$gte = startOfDayIST(from);
    if (to) { const end = startOfDayIST(to); end.setUTCDate(end.getUTCDate() + 1); match.attemptedAt.$lt = end; }
  }
  if (orgId) match.organizationId = new ObjectId(orgId);
  if (courseId) match.courseId = new ObjectId(courseId);
  if (userId) match.userId = new ObjectId(userId);
  const assignments = await db.collection('course_assignments').find(match)
    .project({ userId: 1, courseId: 1, organizationId: 1, attemptedAt: 1 }).sort({ attemptedAt: 1 }).toArray();

  // one enrollment per learner + course (the earliest assignment)
  const seen = new Set();
  let enrollments = assignments.filter(a => {
    const k = `${a.userId}|${a.courseId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const userIds = [...new Set(enrollments.map(e => String(e.userId)))].map(id => new ObjectId(id));
  const users = new Map((await db.collection('users').find({ _id: { $in: userIds }, deletedAt: null })
    .project({ name: 1, email: 1, status: 1, orgId: 1 }).toArray()).map(u => [String(u._id), u]));
  enrollments = enrollments.filter(e => users.has(String(e.userId))); // deleted learners drop out of the report

  const courseIds = [...new Set(enrollments.map(e => String(e.courseId)))].map(id => new ObjectId(id));
  const orgIds = [...new Set(enrollments.map(e => String(e.organizationId)).filter(Boolean))].map(id => new ObjectId(id));
  const liveUserIds = [...new Set(enrollments.map(e => String(e.userId)))].map(id => new ObjectId(id));

  const [courses, orgs, chapters, topics, progress, attempts, completions] = await Promise.all([
    db.collection('courses').find({ _id: { $in: courseIds } }).project({ title: 1 }).toArray(),
    db.collection('organizations').find({ _id: { $in: orgIds } }).project({ org_name: 1 }).toArray(),
    db.collection('chapters').find({ courseId: { $in: courseIds }, deletedAt: null, status: { $ne: 'inactive' } })
      .project({ courseId: 1, title: 1, order: 1 }).sort({ order: 1 }).toArray(),
    db.collection('topics').find({ courseId: { $in: courseIds }, deletedAt: null })
      .project({ courseId: 1, chapterId: 1, video_type: 1, videoUrl: 1 }).toArray(),
    db.collection('progresses').find({ userId: { $in: liveUserIds }, courseId: { $in: courseIds } })
      .project({ userId: 1, courseId: 1, topicId: 1, completed: 1, percentage: 1, updatedAt: 1 }).toArray(),
    db.collection('quiz_attempts').find({ userId: { $in: liveUserIds }, courseId: { $in: courseIds } })
      .project({ userId: 1, courseId: 1, chapterId: 1, topicId: 1, totalScore: 1, passed: 1, createdAt: 1, 'answers.maxScore': 1 }).toArray(),
    db.collection('course_completions').find({ userId: { $in: liveUserIds }, courseId: { $in: courseIds } })
      .project({ userId: 1, courseId: 1, completedAt: 1 }).toArray(),
  ]);
  const courseTitle = new Map(courses.map(c => [String(c._id), c.title || 'Untitled course']));
  const orgName = new Map(orgs.map(o => [String(o._id), o.org_name || 'Unnamed organization']));

  // Course content as the learner player shows it: live chapters' topics.
  const liveChapter = new Set(chapters.map(c => String(c._id)));
  const content = new Map(); // courseId → { lessons:Set, quizzes:Set }
  const chapterOfTopic = new Map();
  for (const t of topics) {
    if (!liveChapter.has(String(t.chapterId))) continue;
    const c = content.get(String(t.courseId)) || { lessons: new Set(), quizzes: new Set() };
    const kind = topicKind(t);
    if (kind === 'lesson' && t.videoUrl) c.lessons.add(String(t._id));
    if (kind === 'quiz') c.quizzes.add(String(t._id));
    content.set(String(t.courseId), c);
    chapterOfTopic.set(String(t._id), String(t.chapterId));
  }

  // Per learner + course: lessons watched, quizzes passed, last activity, best quiz score per quiz.
  const key = (u, c) => `${u}|${c}`;
  const acts = new Map();
  const actOf = (u, c) => {
    const k = key(u, c);
    if (!acts.has(k)) acts.set(k, { watched: new Set(), touched: new Set(), passed: new Set(), best: new Map(), attempted: new Set(), last: 0, lastPass: 0 });
    return acts.get(k);
  };
  for (const p of progress) {
    const a = actOf(p.userId, p.courseId);
    a.touched.add(String(p.topicId));
    if (p.completed) a.watched.add(String(p.topicId));
    a.last = Math.max(a.last, new Date(p.updatedAt).getTime() || 0);
  }
  for (const q of attempts) {
    const a = actOf(q.userId, q.courseId);
    const tid = String(q.topicId);
    a.attempted.add(tid);
    a.touched.add(tid);
    if (q.passed) {
      a.passed.add(tid);
      a.lastPass = Math.max(a.lastPass, new Date(q.createdAt).getTime() || 0);
    }
    a.best.set(tid, Math.max(a.best.get(tid) ?? 0, attemptPct(q)));
    a.last = Math.max(a.last, new Date(q.createdAt).getTime() || 0);
  }
  const completedAt = new Map(completions.map(c => [key(c.userId, c.courseId), c.completedAt]));

  // ── Status per enrollment ─────────────────────────────
  const rows = enrollments.map(e => {
    const u = users.get(String(e.userId));
    const c = content.get(String(e.courseId)) || { lessons: new Set(), quizzes: new Set() };
    const a = acts.get(key(e.userId, e.courseId));
    const watched = a ? [...c.lessons].filter(id => a.watched.has(id)).length : 0;
    const passed = a ? [...c.quizzes].filter(id => a.passed.has(id)).length : 0;
    const items = c.lessons.size + c.quizzes.size;
    const record = completedAt.get(key(e.userId, e.courseId));
    const verified = c.quizzes.size > 0 && watched === c.lessons.size && passed === c.quizzes.size;
    const lastActivity = a?.last ? new Date(a.last) : null;
    const assignedAt = new Date(e.attemptedAt);
    let status;
    if (record || verified) status = 'completed';
    else if (lastActivity && now - lastActivity.getTime() < DROPOUT_DAYS * DAY_MS) status = 'in_progress';
    else if (!lastActivity && now - assignedAt.getTime() < DROPOUT_DAYS * DAY_MS) status = 'not_started';
    else status = 'dropout';
    return {
      learnerId: String(e.userId),
      name: u.name || u.email || 'Learner',
      email: u.email || null,
      accountStatus: u.status || 'active',
      orgId: e.organizationId ? String(e.organizationId) : null,
      organization: orgName.get(String(e.organizationId)) || '—',
      courseId: String(e.courseId),
      course: courseTitle.get(String(e.courseId)) || 'Deleted course',
      enrolledAt: assignedAt,
      progress: status === 'completed' ? 100 : (items ? Math.round(((watched + passed) / items) * 100) : 0),
      status,
      lastActivity,
      // saved completion record, or (verified) when the last quiz was passed
      completedAt: record || (status === 'completed' && a?.lastPass ? new Date(a.lastPass) : null),
    };
  });
  return { rows, chapters, topics, acts, courseTitle, key, now };
}

/**
 * Trainee report: enrollments (in the period, optionally one organization /
 * course) with completion status, learner activity and chapter-wise performance.
 * @param {{ from?: string, to?: string, orgId?: string, courseId?: string }} filters
 */
export async function getTraineeReport({ from, to, orgId, courseId } = {}) {
  const { rows, chapters, topics, acts, courseTitle, key, now } = await loadEnrollments({ from, to, orgId, courseId });

  const countBy = (st) => rows.filter(r => r.status === st).length;
  const completed = countBy('completed'), inProgress = countBy('in_progress'), notStarted = countBy('not_started'), dropout = countBy('dropout');

  // ── Learners (people, not enrollments) ────────────────
  const learnerIds = [...new Set(rows.map(r => r.learnerId))];
  const recentlyActive = new Set(rows.filter(r => r.lastActivity && now - r.lastActivity.getTime() < DROPOUT_DAYS * DAY_MS).map(r => r.learnerId));
  const accountStatus = new Map(rows.map(r => [r.learnerId, r.accountStatus]));
  const accountActive = learnerIds.filter(id => accountStatus.get(id) === 'active').length;

  // ── Enrollments per month ─────────────────────────────
  const byMonth = new Map();
  for (const r of rows) byMonth.set(monthKey(r.enrolledAt), (byMonth.get(monthKey(r.enrolledAt)) || 0) + 1);
  const keys = [...byMonth.keys()].sort();
  const firstMonth = from ? monthKey(startOfDayIST(from)) : keys[0];
  const lastMonth = to ? monthKey(startOfDayIST(to)) : (keys.length ? [keys[keys.length - 1], monthKey(new Date())].sort().pop() : null);
  const monthly = firstMonth && lastMonth && firstMonth <= lastMonth
    ? monthsBetween(firstMonth, lastMonth).map(month => ({ month, enrolled: byMonth.get(month) || 0 }))
    : [];

  // ── Chapter-wise performance ──────────────────────────
  const enrolledByCourse = new Map();
  for (const r of rows) {
    const list = enrolledByCourse.get(r.courseId) || [];
    list.push(r.learnerId);
    enrolledByCourse.set(r.courseId, list);
  }
  const chapterRows = chapters
    .filter(ch => enrolledByCourse.has(String(ch.courseId)))
    .map(ch => {
      const cid = String(ch.courseId), chid = String(ch._id);
      const learners = enrolledByCourse.get(cid);
      const lessonIds = topics.filter(t => String(t.chapterId) === chid && topicKind(t) === 'lesson' && t.videoUrl).map(t => String(t._id));
      const quizIds = topics.filter(t => String(t.chapterId) === chid && topicKind(t) === 'quiz').map(t => String(t._id));
      let started = 0, lessonDoneSum = 0, quizTakers = 0, quizPassers = 0, scoreSum = 0, scoreN = 0;
      for (const uid of learners) {
        const a = acts.get(key(uid, cid));
        const chapterTopics = [...lessonIds, ...quizIds];
        if (a && chapterTopics.some(id => a.touched.has(id))) started += 1;
        if (lessonIds.length) lessonDoneSum += a ? lessonIds.filter(id => a.watched.has(id)).length / lessonIds.length : 0;
        if (quizIds.length && a && quizIds.some(id => a.attempted.has(id))) {
          quizTakers += 1;
          if (quizIds.every(id => a.passed.has(id))) quizPassers += 1;
          const best = quizIds.filter(id => a.best.has(id)).map(id => a.best.get(id));
          if (best.length) { scoreSum += best.reduce((s, v) => s + v, 0) / best.length; scoreN += 1; }
        }
      }
      return {
        courseId: cid,
        course: courseTitle.get(cid) || 'Deleted course',
        chapterId: chid,
        chapter: ch.title || 'Untitled chapter',
        order: ch.order ?? 0,
        enrolled: learners.length,
        started,
        startedPct: pct(started, learners.length),
        lessons: lessonIds.length,
        lessonCompletion: lessonIds.length ? Math.round((lessonDoneSum / learners.length) * 1000) / 10 : null,
        hasQuiz: quizIds.length > 0,
        quizTakers,
        passRate: quizIds.length && quizTakers ? pct(quizPassers, quizTakers) : null, // nobody took it = no rate
        avgScore: scoreN ? Math.round((scoreSum / scoreN) * 10) / 10 : null,
      };
    })
    .sort((a, b) => a.course.localeCompare(b.course) || a.order - b.order);

  const statusOrder = { dropout: 0, not_started: 1, in_progress: 2, completed: 3 };
  return {
    period: { from: from || null, to: to || null, timezone: REPORT_TIMEZONE },
    dropoutDays: DROPOUT_DAYS,
    totals: {
      enrolled: rows.length,
      completed,
      pending: inProgress + notStarted,
      inProgress,
      notStarted,
      dropout,
      completionRate: pct(completed, rows.length),
      dropoutRate: pct(dropout, rows.length),
    },
    learners: {
      total: learnerIds.length,
      active: recentlyActive.size,
      inactive: learnerIds.length - recentlyActive.size,
      accountActive,
      accountInactive: learnerIds.length - accountActive,
    },
    monthly,
    chapters: chapterRows,
    trainees: rows
      .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || (b.enrolledAt - a.enrolledAt))
      .slice(0, TRAINEE_LIMIT),
    traineeCount: rows.length,
    traineeLimit: TRAINEE_LIMIT,
    generatedAt: new Date(),
  };
}
