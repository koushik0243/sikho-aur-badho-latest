import mongoose from 'mongoose';
import { REPORT_TIMEZONE } from './report.service.js';
import { pct, avg, scorePct, dateRange } from './report_stats.js';

const { ObjectId } = mongoose.Types;

// Alert rules. A chapter is only judged once its quiz has MIN_ATTEMPTS evaluated attempts.
export const RULES = {
  MIN_ATTEMPTS: 3,
  LOW_PASS_RATE: 50,      // % of learners who took the quiz and passed
  LOW_SCORE: 40,          // average attempt score %
  LOW_FIRST_TRY: 50,      // % of learners who passed on their first attempt
  MANY_RETRIES: 2,        // average attempts per learner
  HIGH_SKIP: 30,          // % of questions skipped
  LOW_RATING: 3,          // average chapter rating (1–5)
  CRITICAL_PASS_RATE: 25,
  QUESTION_MIN_ANSWERS: 2, // a question needs this many answers / showings to be judged
  FAILED_SHARE: 50,        // answer scored below this % of the marks = failed
  QUESTION_ALERT: 50,      // fail / skip rate that puts a question on the list
  LOW_REVIEW: 2,           // reviews rated this or lower are listed
};
const QUESTION_LIMIT = 500; // the page shows these 20 at a time
const REVIEW_LIMIT = 20;

const oid = (v) => String(v || '');
const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 };

/** Why a chapter is weak (low results) or difficult (hard to get through). */
function chapterFlags(c) {
  const flags = [];
  if (c.evaluated >= RULES.MIN_ATTEMPTS) {
    if (c.passRate !== null && c.passRate < RULES.LOW_PASS_RATE) flags.push({ kind: 'weak', text: `Pass rate ${c.passRate}%` });
    if (c.avgScore !== null && c.avgScore < RULES.LOW_SCORE) flags.push({ kind: 'weak', text: `Avg score ${c.avgScore}%` });
    if (c.firstTryRate !== null && c.firstTryRate < RULES.LOW_FIRST_TRY) flags.push({ kind: 'difficult', text: `First-try pass ${c.firstTryRate}%` });
    if (c.attemptsPerLearner !== null && c.attemptsPerLearner >= RULES.MANY_RETRIES) flags.push({ kind: 'difficult', text: `${c.attemptsPerLearner} attempts per learner` });
    if (c.skipRate !== null && c.skipRate > RULES.HIGH_SKIP) flags.push({ kind: 'difficult', text: `${c.skipRate}% questions skipped` });
  }
  if (c.avgRating !== null && c.avgRating < RULES.LOW_RATING) flags.push({ kind: 'weak', text: `Rated ${c.avgRating} / 5` });
  return flags;
}

function chapterSeverity(c, flags) {
  if (!flags.length) return 'ok';
  const critical = (c.evaluated >= RULES.MIN_ATTEMPTS && c.passRate !== null && c.passRate < RULES.CRITICAL_PASS_RATE) || flags.length >= 3;
  return critical ? 'critical' : 'warning';
}

/**
 * Chapter quality alerts: weak / difficult chapters, questions learners fail or
 * skip, and content problems in the course builder.
 * @param {{ from?: string, to?: string, courseId?: string }} filters
 *   the period applies to quiz attempts and reviews; content checks are always current
 */
export async function getChapterQualityReport({ from, to, courseId } = {}) {
  const db = mongoose.connection.db;
  const range = dateRange(from, to);

  // Live courses (published or draft) and their live chapters.
  const courseMatch = { deletedAt: null, status: { $ne: 'deleted' } };
  if (courseId) courseMatch._id = new ObjectId(courseId);
  const courses = await db.collection('courses').find(courseMatch).project({ title: 1, status: 1 }).toArray();
  const courseIds = courses.map(c => c._id);
  const courseTitle = new Map(courses.map(c => [oid(c._id), c.title || 'Untitled course']));

  const periodMatch = range ? { createdAt: range } : {};
  const [chapters, topics, questions, attempts, reviews] = await Promise.all([
    db.collection('chapters').find({ courseId: { $in: courseIds }, deletedAt: null }).project({ title: 1, order: 1, courseId: 1, status: 1 }).toArray(),
    db.collection('topics').find({ courseId: { $in: courseIds }, deletedAt: null })
      .project({ courseId: 1, chapterId: 1, title: 1, desc: 1, video_type: 1, videoUrl: 1, attachments: 1, quizSettings: 1, order: 1 }).toArray(),
    db.collection('quiz_questions').find({ courseId: { $in: courseIds } })
      .project({ quizId: 1, chapterId: 1, question: 1, deletedAt: 1, difficulty: 1 }).toArray(),
    db.collection('quiz_attempts').find({ courseId: { $in: courseIds }, ...periodMatch })
      .project({ userId: 1, chapterId: 1, topicId: 1, totalScore: 1, passed: 1, status: 1, createdAt: 1, 'answers.questionId': 1, 'answers.questionText': 1, 'answers.status': 1, 'answers.maxScore': 1, 'answers.aiScore': 1 }).toArray(),
    db.collection('reviews').find({ courseId: { $in: courseIds }, ...periodMatch }).project({ chapterId: 1, courseId: 1, userId: 1, rating: 1, text: 1, createdAt: 1 }).toArray(),
  ]);
  const liveChapters = new Map(chapters.map(c => [oid(c._id), c]));
  const chapterTitle = id => liveChapters.get(oid(id))?.title || 'Deleted chapter';
  const chapterOrder = id => liveChapters.get(oid(id))?.order ?? 0;
  const questionDoc = new Map(questions.map(q => [oid(q._id), q]));

  // ── Chapter health ────────────────────────────────────
  const stats = new Map();
  const statFor = (chapterId, cId) => {
    const k = oid(chapterId);
    if (!stats.has(k)) stats.set(k, { chapterId: k, courseId: oid(cId), attempts: 0, evaluated: 0, scores: [], shown: 0, skipped: 0, learners: new Map(), ratings: [] });
    return stats.get(k);
  };
  const sorted = [...attempts].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  for (const a of sorted) {
    if (!liveChapters.has(oid(a.chapterId))) continue;
    const c = statFor(a.chapterId, liveChapters.get(oid(a.chapterId)).courseId);
    c.attempts += 1;
    for (const ans of a.answers || []) { c.shown += 1; if (ans.status === 'skipped') c.skipped += 1; }
    if (a.status === 'pending') continue;
    c.evaluated += 1;
    c.scores.push(scorePct(a));
    const l = c.learners.get(oid(a.userId)) || { tries: 0, passed: false, firstTry: null };
    l.tries += 1;
    if (l.firstTry === null) l.firstTry = Boolean(a.passed);
    if (a.passed) l.passed = true;
    c.learners.set(oid(a.userId), l);
  }
  for (const r of reviews) {
    if (liveChapters.has(oid(r.chapterId))) statFor(r.chapterId, liveChapters.get(oid(r.chapterId)).courseId).ratings.push(Number(r.rating) || 0);
  }
  const chapterRows = [...stats.values()].map(c => {
    const learners = [...c.learners.values()];
    const row = {
      chapterId: c.chapterId,
      course: courseTitle.get(c.courseId) || 'Deleted course',
      chapter: chapterTitle(c.chapterId),
      order: chapterOrder(c.chapterId),
      attempts: c.attempts,
      evaluated: c.evaluated,
      learners: learners.length,
      passRate: pct(learners.filter(l => l.passed).length, learners.length),
      firstTryRate: pct(learners.filter(l => l.firstTry).length, learners.length),
      attemptsPerLearner: learners.length ? Math.round((c.evaluated / learners.length) * 10) / 10 : null,
      avgScore: avg(c.scores),
      skipRate: pct(c.skipped, c.shown),
      avgRating: c.ratings.length ? avg(c.ratings) : null,
      reviews: c.ratings.length,
    };
    const flags = chapterFlags(row);
    return { ...row, flags, severity: chapterSeverity(row, flags), enoughData: c.evaluated >= RULES.MIN_ATTEMPTS };
  }).sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
    || (a.passRate ?? 101) - (b.passRate ?? 101) || a.course.localeCompare(b.course) || a.order - b.order);

  // ── Failed + skipped questions ────────────────────────
  const qs = new Map();
  for (const a of attempts) {
    if (!liveChapters.has(oid(a.chapterId))) continue;
    const evaluated = a.status !== 'pending';
    for (const ans of a.answers || []) {
      const k = oid(ans.questionId);
      const q = qs.get(k) || { questionId: k, text: ans.questionText, chapterId: oid(a.chapterId), shown: 0, skipped: 0, answered: 0, failed: 0, scores: [] };
      q.shown += 1;
      if (ans.status === 'skipped') q.skipped += 1;
      else if (evaluated) {
        const share = ans.maxScore > 0 ? (Number(ans.aiScore) || 0) / ans.maxScore * 100 : 0;
        q.answered += 1;
        q.scores.push(share);
        if (share < RULES.FAILED_SHARE) q.failed += 1;
      }
      qs.set(k, q);
    }
  }
  const questionRow = q => {
    const doc = questionDoc.get(q.questionId);
    const chapterId = doc ? oid(doc.chapterId) : q.chapterId;
    return {
      questionId: q.questionId,
      question: doc?.question || q.text || 'Question',
      difficulty: doc?.difficulty || null,
      removed: Boolean(!doc || doc.deletedAt),
      course: courseTitle.get(oid(liveChapters.get(chapterId)?.courseId)) || 'Deleted course',
      chapter: chapterTitle(chapterId),
      shown: q.shown, skipped: q.skipped, answered: q.answered, failed: q.failed,
      failRate: pct(q.failed, q.answered),
      skipRate: pct(q.skipped, q.shown),
      avgScore: avg(q.scores),
    };
  };
  const allQuestions = [...qs.values()].map(questionRow);
  const failedQuestions = allQuestions
    .filter(q => q.answered >= RULES.QUESTION_MIN_ANSWERS && q.failRate >= RULES.QUESTION_ALERT)
    .sort((a, b) => b.failRate - a.failRate || b.failed - a.failed);
  const skippedQuestions = allQuestions
    .filter(q => q.shown >= RULES.QUESTION_MIN_ANSWERS && q.skipRate >= RULES.QUESTION_ALERT)
    .sort((a, b) => b.skipRate - a.skipRate || b.skipped - a.skipped);

  // ── Content issues ────────────────────────────────────
  const issues = [];
  const issue = (severity, type, t, problem, fix) => issues.push({
    severity, type,
    course: courseTitle.get(oid(t.courseId)) || 'Deleted course',
    chapter: t.chapterId ? chapterTitle(t.chapterId) : '—',
    order: t.chapterId ? chapterOrder(t.chapterId) : -1,
    item: t.item, problem, fix,
  });
  const liveTopics = topics.filter(t => liveChapters.has(oid(t.chapterId)));
  const questionsByQuiz = new Map();
  for (const q of questions) {
    if (q.deletedAt) continue;
    const list = questionsByQuiz.get(oid(q.quizId)) || [];
    list.push(q);
    questionsByQuiz.set(oid(q.quizId), list);
  }
  for (const t of liveTopics) {
    const at = { courseId: t.courseId, chapterId: t.chapterId, item: t.title || 'Untitled topic' };
    const type = String(t.video_type || '').toLowerCase();
    if (type === 'lesson' && !t.videoUrl) {
      issue('critical', 'Lesson', at, 'Lesson has no video', 'Upload the lesson video in the course builder.');
    } else if (type === 'quiz') {
      const active = questionsByQuiz.get(oid(t._id)) || [];
      const activeIds = new Set(active.map(q => oid(q._id)));
      const selected = (t.quizSettings?.selectedQuestionIds || []).map(String);
      const pool = selected.length ? selected.filter(id => activeIds.has(id)).length : active.length;
      const missing = selected.filter(id => !activeIds.has(id)).length;
      const wanted = Number(t.quizSettings?.maxQuestions) || 0;
      if (pool === 0) issue('critical', 'Quiz', at, 'Quiz has no questions', 'Generate or create questions and select them for the quiz.');
      else if (wanted > 0 && pool < wanted) issue('warning', 'Quiz', at, `Quiz asks up to ${wanted} questions but only ${pool} are selected`, 'Select more questions or lower "Max questions".');
      if (missing > 0) issue('warning', 'Quiz', at, `${missing} selected question${missing === 1 ? ' was' : 's were'} deleted`, 'Re-open the quiz and update its selected questions.');
      const seen = new Map();
      active.forEach(q => { const k = String(q.question || '').trim().toLowerCase(); seen.set(k, (seen.get(k) || 0) + 1); });
      const dupes = [...seen.values()].filter(n => n > 1).reduce((s, n) => s + n - 1, 0);
      if (dupes > 0) issue('info', 'Quiz', at, `${dupes} duplicate question${dupes === 1 ? '' : 's'}`, 'Remove the repeated questions.');
    } else if (type === 'zoom_link' && !t.videoUrl) {
      issue('warning', 'Zoom', at, 'Zoom session has no meeting link', 'Add the Zoom link.');
    } else if (type === 'assignment' && !String(t.desc || '').trim() && !(t.attachments || []).length) {
      issue('warning', 'Homework', at, 'Assignment has no instructions or files', 'Add a description or attach the assignment file.');
    }
  }
  const topicsPerChapter = new Map();
  liveTopics.forEach(t => topicsPerChapter.set(oid(t.chapterId), (topicsPerChapter.get(oid(t.chapterId)) || 0) + 1));
  for (const c of chapters) {
    const at = { courseId: c.courseId, chapterId: c._id, item: c.title || 'Untitled chapter' };
    if (!topicsPerChapter.get(oid(c._id))) issue('warning', 'Chapter', at, 'Chapter is empty', 'Add lessons or remove the chapter.');
    else if (!liveTopics.some(t => oid(t.chapterId) === oid(c._id) && t.video_type === 'quiz')) issue('info', 'Chapter', at, 'Chapter has no quiz', 'Add a quiz so learning can be measured.');
  }
  for (const q of failedQuestions.filter(x => x.failRate === 100 && !x.removed)) {
    issue('warning', 'Question', { courseId: liveChapters.get(oid(questionDoc.get(q.questionId)?.chapterId))?.courseId, chapterId: questionDoc.get(q.questionId)?.chapterId, item: q.question },
      `No learner got this right (${q.answered} answers)`, 'Check the question and its expected answer are correct and clear.');
  }
  issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.course.localeCompare(b.course) || a.order - b.order);

  // Learner-reported: low ratings with comments.
  const users = await db.collection('users').find({ _id: { $in: reviews.filter(r => r.rating <= RULES.LOW_REVIEW).map(r => r.userId) } }).project({ name: 1 }).toArray();
  const userName = new Map(users.map(u => [oid(u._id), u.name || 'Learner']));
  const lowReviews = reviews
    .filter(r => r.rating <= RULES.LOW_REVIEW && liveChapters.has(oid(r.chapterId)))
    .sort((a, b) => a.rating - b.rating || new Date(b.createdAt) - new Date(a.createdAt))
    .map(r => ({ course: courseTitle.get(oid(r.courseId)) || 'Deleted course', chapter: chapterTitle(r.chapterId), learner: userName.get(oid(r.userId)) || 'Learner', rating: r.rating, text: r.text, createdAt: r.createdAt }));

  const count = (list, sev) => list.filter(x => x.severity === sev).length;
  return {
    period: { from: from || null, to: to || null, timezone: REPORT_TIMEZONE },
    rules: RULES,
    summary: {
      chaptersChecked: chapters.length,
      chaptersWithQuizData: chapterRows.length,
      weakChapters: chapterRows.filter(c => c.flags.some(f => f.kind === 'weak')).length,
      difficultChapters: chapterRows.filter(c => c.flags.some(f => f.kind === 'difficult')).length,
      criticalChapters: count(chapterRows, 'critical'),
      failedQuestions: failedQuestions.length,
      skippedQuestions: skippedQuestions.length,
      contentIssues: issues.length,
      criticalIssues: count(issues, 'critical'),
      warningIssues: count(issues, 'warning'),
      infoIssues: count(issues, 'info'),
      lowReviews: lowReviews.length,
    },
    chapters: chapterRows,
    failedQuestions: failedQuestions.slice(0, QUESTION_LIMIT),
    skippedQuestions: skippedQuestions.slice(0, QUESTION_LIMIT),
    questionLimit: QUESTION_LIMIT,
    contentIssues: issues,
    lowReviews: lowReviews.slice(0, REVIEW_LIMIT),
    generatedAt: new Date(),
  };
}
