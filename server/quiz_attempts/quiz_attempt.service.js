import OpenAI from 'openai';
import QuizAttempt from './quiz_attempt.model.js';
import QuizLock, { VideoLock } from './quiz_lock.model.js';
import Topic from '../topics/topic.model.js';
import { normalizeQuizSettings } from './quiz_settings.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function evaluateAnswer(questionText, userAnswer, maxScore) {
  if (!userAnswer?.trim()) {
    return { score: 0, feedback: 'No answer provided.' };
  }
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 120,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a quiz evaluator. Return JSON only. Be lenient with grammar — answers are voice-transcribed.',
        },
        {
          role: 'user',
          content: `Rate this answer from 0 to 10.\n\nQuestion: ${questionText}\nStudent Answer: ${userAnswer}\n\nRubric:\n10 = fully correct and complete\n7-9 = mostly correct, minor gaps\n4-6 = partially correct, shows understanding\n1-3 = minimal relevant content\n0 = wrong, off-topic, or empty\n\nReturn: {"rating": <0-10>, "feedback": "<one concise sentence>"}`,
        },
      ],
    });
    const parsed = JSON.parse(res.choices[0].message.content);
    const rating = Math.min(10, Math.max(0, Number(parsed.rating) || 0));
    return {
      score: Math.round((rating / 10) * maxScore * 10) / 10,
      feedback: String(parsed.feedback || '').slice(0, 200),
    };
  } catch {
    return { score: 0, feedback: 'Evaluation unavailable.' };
  }
}

const httpError = (status, message) => Object.assign(new Error(message), { status });

export const submitAttempt = async ({ userId, topicId, courseId, chapterId, answers, timeTakenSec = null }) => {
  const n = answers.length;
  if (n === 0) throw new Error('No answers submitted.');

  // The quiz's own settings (course builder → Settings tab) decide the rules.
  const topic = await Topic.findById(topicId).select('quizSettings').lean();
  const settings = normalizeQuizSettings(topic?.quizSettings);
  if (settings.attemptsAllowed > 0) {
    const used = await QuizAttempt.countDocuments({ userId, topicId });
    if (used >= settings.attemptsAllowed) {
      throw httpError(403, `No attempts left — this quiz allows ${settings.attemptsAllowed} attempt${settings.attemptsAllowed === 1 ? '' : 's'}.`);
    }
  }

  const base = Math.floor(100 / n);
  const remainder = 100 - base * n;

  const withMax = answers.map((a, i) => ({
    ...a,
    maxScore: i === n - 1 ? base + remainder : base,
  }));

  const evaluations = await Promise.all(
    withMax.map(a => evaluateAnswer(a.questionText, a.userAnswer, a.maxScore))
  );

  const evaluated = withMax.map((a, i) => ({
    ...a,
    aiScore:    evaluations[i].score,
    aiFeedback: evaluations[i].feedback,
  }));

  const totalScore = Math.min(100, Math.round(evaluated.reduce((s, a) => s + a.aiScore, 0)));
  const passed = totalScore >= settings.passingGrade;

  const attempt = await QuizAttempt.create({
    userId, topicId, courseId, chapterId,
    answers: evaluated,
    totalScore,
    passed,
    passingGrade: settings.passingGrade,
    timeTakenSec,
    status: 'evaluated',
    evaluatedAt: new Date(),
  });

  return attempt;
};

export const getAttemptHistory = async ({ userId, topicId }) => {
  return await QuizAttempt.find({ userId, topicId })
    .select('totalScore passed createdAt')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
};

export const getAttemptsByCourse = async ({ userId, courseId, chapterId }) => {
  const query = { userId, courseId };
  if (chapterId) query.chapterId = chapterId;
  return await QuizAttempt.find(query)
    .populate('topicId',   'title')
    .populate('chapterId', 'title')
    .sort({ createdAt: -1 })
    .lean();
};

export const getAttemptsByCourseAdmin = async ({ courseId }) => {
  return await QuizAttempt.find({ courseId })
    .populate('userId',    'name email')
    .populate('topicId',   'title')
    .populate('chapterId', 'title')
    .sort({ createdAt: -1 })
    .lean();
};

// ── Quiz / video activity locks ──────────────────────────────────────────────
// The holding tab heartbeats every ~15s; a lock that misses a few beats lapses.
export const QUIZ_LOCK_TTL_MS = 45 * 1000;

const acquireLock = (Model, { userId, courseId, topicId, ownerId }) => Model.findOneAndUpdate(
  { userId, courseId },
  { userId, courseId, topicId, ownerId: ownerId || null, expiresAt: new Date(Date.now() + QUIZ_LOCK_TTL_MS) },
  { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
).lean();

// With ownerId, only that tab's lock is released — another tab may have taken
// it over since.
const releaseLock = (Model, { userId, courseId, ownerId }) =>
  Model.deleteOne(ownerId ? { userId, courseId, ownerId } : { userId, courseId });

// Active lock for this learner + course, or null. The TTL index only sweeps
// about once a minute, so expiry is also checked here.
const getLock = (Model, { userId, courseId }) =>
  Model.findOne({ userId, courseId, expiresAt: { $gt: new Date() } })
    .select('topicId ownerId expiresAt createdAt')
    .lean();

export const acquireQuizLock  = (args) => acquireLock(QuizLock, args);
export const releaseQuizLock  = (args) => releaseLock(QuizLock, args);
export const getQuizLock      = (args) => getLock(QuizLock, args);

// Quiz heartbeat. The most recent activity wins: if a lesson video of this
// course started playing in another tab/device after the quiz began, the quiz
// is cancelled — its lock is dropped and { cancelled: true } is returned so
// the quiz tab resets.
export const heartbeatQuizLock = async ({ userId, courseId, topicId, ownerId }) => {
  const [quizLock, videoLock] = await Promise.all([
    getLock(QuizLock, { userId, courseId }),
    getLock(VideoLock, { userId, courseId }),
  ]);
  const videoElsewhere = videoLock && (!ownerId || videoLock.ownerId !== ownerId);
  const quizStartedAt  = quizLock?.createdAt ? new Date(quizLock.createdAt).getTime() : Date.now();
  if (videoElsewhere && new Date(videoLock.createdAt).getTime() >= quizStartedAt - 1000) {
    await releaseLock(QuizLock, { userId, courseId, ownerId });
    return { cancelled: true };
  }
  const lock = await acquireLock(QuizLock, { userId, courseId, topicId, ownerId });
  return { cancelled: false, lock };
};

export const acquireVideoLock = (args) => acquireLock(VideoLock, args);
export const releaseVideoLock = (args) => releaseLock(VideoLock, args);
export const getVideoLock     = (args) => getLock(VideoLock, args);
