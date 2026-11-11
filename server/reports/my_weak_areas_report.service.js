import mongoose from 'mongoose';
import { getMyProgressReport } from './my_progress_report.service.js';
import { topicKind } from './trainee_report.service.js';
import { normalizeQuizSettings } from '../quiz_attempts/quiz_settings.js';
import { pct } from './report_stats.js';

const { ObjectId } = mongoose.Types;
const oid = (v) => String(v || '');
const round = (n) => Math.round(n);
const LOW_SCORE = 50;     // best quiz score under this = low chapter
const VERY_LOW = 40;      // high priority
const HIGH_SKIP = 50;     // % of a chapter's questions skipped
const FEEDBACK_LIMIT = 3; // AI feedback notes shown per chapter
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

const isBlank = (x) => x.status === 'skipped' || !String(x.userAnswer || '').trim();

/**
 * A learner's weak areas: low chapters, skipped questions and revision
 * suggestions. Never reveals expected answers — it points to the lessons instead.
 * @param {{ userId: string, courseId?: string }} filters
 */
export async function getMyWeakAreasReport({ userId, courseId }) {
  const db = mongoose.connection.db;
  const me = new ObjectId(userId);
  const progress = await getMyProgressReport({ userId, courseId });
  const courseIds = progress.courses.map(c => new ObjectId(c.courseId));

  const [topics, watched, attempts] = await Promise.all([
    db.collection('topics').find({ courseId: { $in: courseIds }, deletedAt: null })
      .project({ courseId: 1, chapterId: 1, title: 1, video_type: 1, videoUrl: 1, quizSettings: 1, order: 1 }).sort({ order: 1 }).toArray(),
    db.collection('progresses').find({ userId: me, courseId: { $in: courseIds }, completed: true }).project({ topicId: 1 }).toArray(),
    db.collection('quiz_attempts').find({ userId: me, courseId: { $in: courseIds }, status: { $ne: 'pending' } })
      .project({ courseId: 1, chapterId: 1, topicId: 1, createdAt: 1, 'answers.questionId': 1, 'answers.questionText': 1, 'answers.status': 1, 'answers.userAnswer': 1, 'answers.aiScore': 1, 'answers.maxScore': 1, 'answers.aiFeedback': 1 })
      .sort({ createdAt: 1 }).toArray(),
  ]);
  const watchedSet = new Set(watched.map(w => oid(w.topicId)));
  const lessonsOf = new Map(), quizzesOf = new Map();
  for (const t of topics) {
    const k = oid(t.chapterId);
    const kind = topicKind(t);
    if (kind === 'lesson' && t.videoUrl) lessonsOf.set(k, [...(lessonsOf.get(k) || []), { title: t.title || 'Lesson', watched: watchedSet.has(oid(t._id)) }]);
    if (kind === 'quiz') quizzesOf.set(k, [...(quizzesOf.get(k) || []), { topicId: oid(t._id), title: t.title || 'Quiz', settings: normalizeQuizSettings(t.quizSettings) }]);
  }

  // ── Skipped questions (each question once, with its latest outcome) ──
  const questions = new Map();
  for (const a of attempts) {
    for (const x of a.answers || []) {
      const k = oid(x.questionId);
      const q = questions.get(k) || { questionId: k, question: x.questionText || 'Question', courseId: oid(a.courseId), chapterId: oid(a.chapterId), topicId: oid(a.topicId), shown: 0, skipped: 0, lastSkipped: false, lastScore: null };
      const blank = isBlank(x);
      q.shown += 1;
      if (blank) q.skipped += 1;
      q.lastSkipped = blank;
      q.lastScore = blank ? null : (x.maxScore > 0 ? round(Math.min(100, ((Number(x.aiScore) || 0) / x.maxScore) * 100)) : 0);
      questions.set(k, q);
    }
  }
  const chapterOf = new Map(progress.chapterRows.map(c => [c.chapterId, c]));
  const quizTitle = new Map(topics.filter(t => topicKind(t) === 'quiz').map(t => [oid(t._id), t.title || 'Quiz']));
  const skippedQuestions = [...questions.values()].filter(q => q.skipped > 0).map(q => ({
    question: q.question, quiz: quizTitle.get(q.topicId) || 'Quiz',
    course: chapterOf.get(q.chapterId)?.course || 'Course', chapter: chapterOf.get(q.chapterId)?.chapter || 'Chapter', courseId: q.courseId,
    shown: q.shown, skipped: q.skipped, stillSkipped: q.lastSkipped, lastScore: q.lastScore,
  })).sort((a, b) => Number(b.stillSkipped) - Number(a.stillSkipped) || b.skipped - a.skipped || a.question.localeCompare(b.question));

  // Low-scoring feedback per chapter (latest attempt per question).
  const feedbackOf = new Map();
  for (const a of attempts) {
    for (const x of a.answers || []) {
      if (isBlank(x) || !x.aiFeedback) continue;
      const score = x.maxScore > 0 ? (Number(x.aiScore) || 0) / x.maxScore * 100 : 0;
      if (score >= 70) continue;
      const k = oid(a.chapterId);
      const list = (feedbackOf.get(k) || []).filter(f => f.question !== x.questionText);
      list.push({ question: x.questionText || 'Question', score: round(score), feedback: x.aiFeedback });
      feedbackOf.set(k, list);
    }
  }

  // ── Low chapters + revision suggestions ───────────────
  const courseStatus = new Map(progress.courses.map(c => [c.courseId, c.status]));
  const lowChapters = [];
  for (const c of progress.chapterRows) {
    if (c.status === 'completed' && c.result !== 'failed') continue;
    const lessons = lessonsOf.get(c.chapterId) || [];
    const unwatched = lessons.filter(l => !l.watched);
    const quizzes = quizzesOf.get(c.chapterId) || [];
    const chapterQs = [...questions.values()].filter(q => q.chapterId === c.chapterId);
    const shown = chapterQs.reduce((s, q) => s + q.shown, 0), skipped = chapterQs.reduce((s, q) => s + q.skipped, 0);
    const skipRate = pct(skipped, shown);
    const attempted = c.quizzes > 0 && c.attempts > 0;
    const started = c.status !== 'not_started';
    const reasons = [];
    if (c.result === 'failed') reasons.push(`Quiz not passed (best ${c.bestScore ?? 0}%)`);
    else if (attempted && c.bestScore !== null && c.bestScore < LOW_SCORE) reasons.push(`Low quiz score (${c.bestScore}%)`);
    if (skipRate !== null && skipRate >= HIGH_SKIP) reasons.push(`${skipRate}% of questions skipped`);
    if (started && unwatched.length) reasons.push(`${unwatched.length} lesson${unwatched.length === 1 ? '' : 's'} not watched`);
    if (!reasons.length) continue;
    const priority = c.result === 'failed' && (c.bestScore ?? 0) < VERY_LOW ? 'high' : c.result === 'failed' || (skipRate ?? 0) >= HIGH_SKIP ? 'medium' : 'low';

    // What to do, in order.
    const steps = [];
    const toWatch = unwatched.length ? unwatched : (c.result === 'failed' ? lessons : []);
    if (toWatch.length) steps.push({ kind: 'watch', text: `${unwatched.length ? 'Watch' : 'Rewatch'} ${toWatch.map(l => `“${l.title}”`).join(', ')}` });
    const stillSkipped = chapterQs.filter(q => q.lastSkipped).length;
    if (stillSkipped) steps.push({ kind: 'skip', text: `Prepare for the ${stillSkipped} question${stillSkipped === 1 ? '' : 's'} you skipped (listed under Skipped questions) — even a short spoken answer earns partial marks; a skipped one scores 0` });
    for (const quiz of quizzes) {
      const test = progress.tests.find(t => t.topicId === quiz.topicId);
      if (test?.passed) continue;
      const allowed = quiz.settings.attemptsAllowed;
      const used = test?.attempts || 0;
      const left = allowed > 0 ? Math.max(0, allowed - used) : null;
      steps.push({
        kind: 'retake',
        text: left === 0
          ? `“${quiz.title}”: no attempts left — ask your store owner for help`
          : `Retake “${quiz.title}” — you need ${quiz.settings.passingGrade}% to pass${test ? ` (best so far ${test.bestScore}%)` : ''}${left !== null ? `; ${left} attempt${left === 1 ? '' : 's'} left` : ''}`,
      });
    }
    lowChapters.push({
      courseId: c.courseId, course: c.course, chapterId: c.chapterId, chapter: c.chapter, order: c.order,
      bestScore: c.bestScore, result: c.result, attempts: c.attempts, progress: c.progress, status: c.status,
      lessons: lessons.length, lessonsWatched: lessons.length - unwatched.length, skipRate,
      priority, reasons, steps, feedback: (feedbackOf.get(c.chapterId) || []).slice(-FEEDBACK_LIMIT),
      courseStopped: courseStatus.get(c.courseId) === 'dropout',
    });
  }
  lowChapters.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.bestScore ?? 101) - (b.bestScore ?? 101) || a.course.localeCompare(b.course) || a.order - b.order);

  // ── General tips from the patterns ────────────────────
  const tips = [];
  const allShown = [...questions.values()].reduce((s, q) => s + q.shown, 0);
  const allSkipped = [...questions.values()].reduce((s, q) => s + q.skipped, 0);
  if (allShown && allSkipped / allShown >= 0.5) tips.push('You skip most questions. A short answer in your own words still earns partial marks — try to say something for every question.');
  const late = attempts.flatMap(a => (a.answers || []).slice(10)), early = attempts.flatMap(a => (a.answers || []).slice(0, 5));
  const lateRate = pct(late.filter(isBlank).length, late.length), earlyRate = pct(early.filter(isBlank).length, early.length);
  if (lateRate !== null && earlyRate !== null && lateRate - earlyRate >= 15) tips.push(`You skip more near the end of a test (${lateRate}% after question 10 vs ${earlyRate}% in the first 5). Keep answers short so you have time for every question.`);
  const stopped = progress.courses.filter(c => c.status === 'dropout');
  if (stopped.length) tips.push(`Pick up where you left off in ${stopped.map(c => `“${c.course}”`).join(', ')} — no learning there for 30+ days.`);
  if (progress.courses.some(c => c.phases.aptitude.status === 'not_started')) tips.push('Take the aptitude test for your courses — it sets the right level of questions for you.');

  return {
    filters: { courseId: courseId || null },
    options: progress.options,
    me: progress.me,
    rules: { LOW_SCORE, VERY_LOW, HIGH_SKIP },
    totals: {
      lowChapters: lowChapters.length,
      highPriority: lowChapters.filter(c => c.priority === 'high').length,
      skippedQuestions: skippedQuestions.length,
      stillSkipped: skippedQuestions.filter(q => q.stillSkipped).length,
      lessonsToWatch: lowChapters.reduce((s, c) => s + (c.lessons - c.lessonsWatched), 0),
      quizzesToRetake: lowChapters.reduce((s, c) => s + c.steps.filter(x => x.kind === 'retake').length, 0),
    },
    lowChapters,
    skippedQuestions,
    tips,
    generatedAt: new Date(),
  };
}
