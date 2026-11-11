import mongoose from 'mongoose';
import { REPORT_TIMEZONE } from './report.service.js';
import { pct, avg, dateRange } from './report_stats.js';
import { attemptPct } from './trainee_report.service.js';

const { ObjectId } = mongoose.Types;
const oid = (v) => String(v || '');
const round = (n) => Math.round(n);
const LIST_LIMIT = 10;

// Score bands for a single spoken answer (its AI score out of the question's marks).
export const BANDS = [
  { key: 'full', label: 'Full marks', min: 80 },
  { key: 'partial', label: 'Partial', min: 1 },
  { key: 'zero', label: 'No marks', min: 0 },
];
const bandOf = (score) => BANDS.find(b => score >= b.min).key;
// Question position buckets for skip analysis (does skipping grow later in a test?).
const POSITIONS = [{ label: 'Questions 1–5', to: 5 }, { label: 'Questions 6–10', to: 10 }, { label: 'Questions 11–15', to: 15 }, { label: 'Question 16+', to: Infinity }];
const DIFFICULTY = ['beginner', 'intermediate', 'advanced'];

/**
 * A learner's own test results: MCQ and speech scores, and skip analysis,
 * across chapter quizzes and aptitude tests.
 * @param {{ userId: string, from?: string, to?: string, courseId?: string }} filters the period applies to the date taken
 */
export async function getMyTestResultsReport({ userId, from, to, courseId }) {
  const db = mongoose.connection.db;
  const me = new ObjectId(userId);
  const range = dateRange(from, to);
  const match = { userId: me, status: { $ne: 'pending' } };
  if (range) match.createdAt = range;
  if (courseId) match.courseId = new ObjectId(courseId);

  const [user, quizAttempts, aptitudeAttempts, myCourseIds] = await Promise.all([
    db.collection('users').findOne({ _id: me }, { projection: { name: 1, email: 1 } }),
    db.collection('quiz_attempts').find(match).project({ courseId: 1, chapterId: 1, topicId: 1, totalScore: 1, passed: 1, timeTakenSec: 1, createdAt: 1, answers: 1 }).sort({ createdAt: 1 }).toArray(),
    db.collection('aptitude_attempts').find(match).project({ courseId: 1, totalScore: 1, level: 1, timeTakenSec: 1, createdAt: 1, answers: 1 }).sort({ createdAt: 1 }).toArray(),
    db.collection('quiz_attempts').distinct('courseId', { userId: me }),
  ]);
  const questionIds = [...new Set([...quizAttempts, ...aptitudeAttempts].flatMap(a => (a.answers || []).map(x => oid(x.questionId))))].filter(id => mongoose.isValidObjectId(id)).map(id => new ObjectId(id));
  const courseIdList = [...new Set([...quizAttempts, ...aptitudeAttempts].map(a => oid(a.courseId)).concat(myCourseIds.map(oid)))].map(id => new ObjectId(id));
  const [quizQs, aptQs, courses, chapters, topics] = await Promise.all([
    db.collection('quiz_questions').find({ _id: { $in: questionIds } }).project({ difficulty: 1, options: 1 }).toArray(),
    db.collection('aptitude_questions').find({ _id: { $in: questionIds } }).project({ difficulty: 1, options: 1 }).toArray(),
    db.collection('courses').find({ _id: { $in: courseIdList } }).project({ title: 1, deletedAt: 1, status: 1 }).toArray(),
    db.collection('chapters').find({ courseId: { $in: courseIdList } }).project({ title: 1, order: 1 }).toArray(),
    db.collection('topics').find({ _id: { $in: [...new Set(quizAttempts.map(a => oid(a.topicId)))].map(id => new ObjectId(id)) } }).project({ title: 1 }).toArray(),
  ]);
  const qInfo = new Map([...quizQs, ...aptQs].map(q => [oid(q._id), { difficulty: q.difficulty || null, mcq: Array.isArray(q.options) && q.options.length > 0 }]));
  const courseTitle = new Map(courses.map(c => [oid(c._id), `${c.title || 'Untitled course'}${c.deletedAt || c.status === 'deleted' ? ' (deleted)' : ''}`]));
  const chapterInfo = new Map(chapters.map(c => [oid(c._id), { title: c.title || 'Chapter', order: c.order ?? 0 }]));
  const quizTitle = new Map(topics.map(t => [oid(t._id), t.title || 'Quiz']));

  // ── Every answer, flattened ───────────────────────────
  const answers = [];
  const attemptRows = [];
  const add = (a, kind) => {
    const list = a.answers || [];
    const label = kind === 'quiz' ? quizTitle.get(oid(a.topicId)) || 'Quiz' : 'Aptitude test';
    list.forEach((x, i) => {
      const info = qInfo.get(oid(x.questionId)) || { difficulty: null, mcq: false };
      const score = x.maxScore > 0 ? Math.min(100, ((Number(x.aiScore) || 0) / x.maxScore) * 100) : 0;
      answers.push({
        kind, test: label, courseId: oid(a.courseId), chapterId: oid(a.chapterId), topicId: oid(a.topicId), questionId: oid(x.questionId),
        question: x.questionText || 'Question', position: i + 1, difficulty: info.difficulty, type: info.mcq ? 'mcq' : 'speech',
        // a blank answer counts as skipped (nothing was said)
        skipped: x.status === 'skipped' || !String(x.userAnswer || '').trim(), blank: x.status !== 'skipped' && !String(x.userAnswer || '').trim(),
        score: round(score), feedback: x.aiFeedback || '', takenAt: a.createdAt,
      });
    });
    const skipped = list.filter(x => x.status === 'skipped' || !String(x.userAnswer || '').trim()).length;
    attemptRows.push({
      kind, test: label, course: courseTitle.get(oid(a.courseId)) || 'Course', chapter: kind === 'quiz' ? chapterInfo.get(oid(a.chapterId))?.title || 'Chapter' : '—',
      takenAt: a.createdAt, score: round(attemptPct(a)), passed: kind === 'quiz' ? Boolean(a.passed) : null, level: a.level || null,
      questions: list.length, skipped, answered: list.length - skipped, skipRate: pct(skipped, list.length), timeTakenSec: a.timeTakenSec ?? null,
    });
  };
  quizAttempts.forEach(a => add(a, 'quiz'));
  aptitudeAttempts.forEach(a => add(a, 'aptitude'));

  // ── Scores: MCQ vs speech ─────────────────────────────
  const scoreBlock = (list) => {
    const answered = list.filter(x => !x.skipped);
    return {
      questions: list.length, answered: answered.length, skipped: list.length - answered.length,
      avgScore: answered.length ? round(avg(answered.map(x => x.score))) : null,          // marks on answered questions
      overallScore: list.length ? round(avg(list.map(x => (x.skipped ? 0 : x.score)))) : null, // skipped count as 0
      bands: Object.fromEntries(BANDS.map(b => [b.key, answered.filter(x => bandOf(x.score) === b.key).length])),
    };
  };
  const speech = scoreBlock(answers.filter(x => x.type === 'speech'));
  const mcq = scoreBlock(answers.filter(x => x.type === 'mcq'));

  // ── Skip analysis ─────────────────────────────────────
  const skipStats = (list) => ({ shown: list.length, skipped: list.filter(x => x.skipped).length, skipRate: pct(list.filter(x => x.skipped).length, list.length) });
  const byDifficulty = DIFFICULTY.map(d => ({ difficulty: d, ...skipStats(answers.filter(x => x.difficulty === d)), avgScore: (() => { const a = answers.filter(x => x.difficulty === d && !x.skipped); return a.length ? round(avg(a.map(x => x.score))) : null; })() }))
    .filter(r => r.shown > 0);
  let prev = 0;
  const byPosition = POSITIONS.map(p => { const r = { label: p.label, ...skipStats(answers.filter(x => x.position > prev && x.position <= p.to)) }; prev = p.to; return r; }).filter(r => r.shown > 0);
  const testKey = x => (x.kind === 'quiz' ? `q|${x.topicId}` : `a|${x.courseId}`);
  const byTest = [...new Set(answers.map(testKey))].map(k => {
    const list = answers.filter(x => testKey(x) === k);
    const first = list[0];
    const tries = attemptRows.filter(r => r.kind === first.kind && r.test === first.test && r.course === (courseTitle.get(first.courseId) || 'Course'));
    return {
      key: k, kind: first.kind, test: first.test, course: courseTitle.get(first.courseId) || 'Course',
      chapter: first.kind === 'quiz' ? chapterInfo.get(first.chapterId)?.title || 'Chapter' : '—',
      attempts: tries.length, bestScore: tries.length ? Math.max(...tries.map(t => t.score)) : null,
      ...skipStats(list), speechScore: (() => { const a = list.filter(x => !x.skipped); return a.length ? round(avg(a.map(x => x.score))) : null; })(),
    };
  }).sort((a, b) => (b.skipRate ?? 0) - (a.skipRate ?? 0) || a.test.localeCompare(b.test));
  const perQuestion = new Map();
  answers.forEach(x => {
    const g = perQuestion.get(x.questionId) || { questionId: x.questionId, question: x.question, test: x.test, course: courseTitle.get(x.courseId) || 'Course', shown: 0, skipped: 0, scores: [], feedback: '' };
    g.shown += 1;
    if (x.skipped) g.skipped += 1; else { g.scores.push(x.score); if (x.feedback) g.feedback = x.feedback; }
    perQuestion.set(x.questionId, g);
  });
  const questions = [...perQuestion.values()];
  const mostSkipped = questions.filter(q => q.skipped > 0).sort((a, b) => b.skipped - a.skipped || b.shown - a.shown).slice(0, LIST_LIMIT)
    .map(q => ({ question: q.question, test: q.test, course: q.course, shown: q.shown, skipped: q.skipped, skipRate: pct(q.skipped, q.shown) }));
  const lowestScored = questions.filter(q => q.scores.length).map(q => ({ question: q.question, test: q.test, course: q.course, answered: q.scores.length, avgScore: round(avg(q.scores)), feedback: q.feedback }))
    .sort((a, b) => a.avgScore - b.avgScore).slice(0, LIST_LIMIT);
  // Fully skipped attempts (often: time ran out, or the test was left unanswered).
  const allSkippedAttempts = attemptRows.filter(r => r.questions > 0 && r.answered === 0).length;

  const allSkip = skipStats(answers);
  return {
    period: { from: from || null, to: to || null, timezone: REPORT_TIMEZONE },
    filters: { courseId: courseId || null },
    options: { courses: myCourseIds.map(oid).filter(id => courseTitle.has(id)).map(id => ({ id, title: courseTitle.get(id) })).sort((a, b) => a.title.localeCompare(b.title)) },
    me: { name: user?.name || user?.email || 'Me' },
    bands: BANDS,
    totals: {
      tests: attemptRows.length,
      quizAttempts: quizAttempts.length,
      aptitudeAttempts: aptitudeAttempts.length,
      testScore: attemptRows.length ? round(avg(attemptRows.map(r => r.score))) : null,
      ...allSkip,
      answered: allSkip.shown - allSkip.skipped,
      allSkippedAttempts,
      blankAnswers: answers.filter(x => x.blank).length,
    },
    speech,
    mcq,
    byDifficulty,
    byPosition,
    byTest,
    attempts: [...attemptRows].reverse(),
    mostSkipped,
    lowestScored,
    generatedAt: new Date(),
  };
}
