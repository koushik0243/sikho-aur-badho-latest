import mongoose from 'mongoose';
import OpenAI from 'openai';
import QuizQuestion from './quiz_question.model.js';
import Topic from '../topics/topic.model.js';
import Course from '../courses/course.model.js';
import AptitudeAttempt from '../aptitude_attempts/aptitude_attempt.model.js';
import { normalizeQuizSettings } from '../quiz_attempts/quiz_settings.js';
import { getLessonTranscript, limitTranscript } from '../topics/topic.transcript.js';
import { ENGLISH_ONLY_RULE, generateEnglishQuestions } from '../_helpers/qaEnglish.js';

const { ObjectId } = mongoose.Types;

// QA origin: 'generated' (AI) or 'created' (hand-written by a super admin).
export const QA_STATUSES = ['generated', 'created'];

// Aptitude level -> quiz-question difficulty distribution. Keys on the left are
// aptitude_attempts.level values; keys on the right are quiz_questions.difficulty tiers.
const LEVEL_DIFFICULTY_SPLIT = {
  beginner:     { beginner: 0.8, intermediate: 0.1, advanced: 0.1 },
  intermediate: { beginner: 0.1, intermediate: 0.8, advanced: 0.1 },
  expert:       { beginner: 0.1, intermediate: 0.1, advanced: 0.8 },
};
const DIFFICULTY_TIERS = ['beginner', 'intermediate', 'advanced'];

const buildQuery = (filters = {}) => {
  const query = { deletedAt: null };
  if (QA_STATUSES.includes(filters.status)) query.status = filters.status;
  if (filters.quizId && ObjectId.isValid(filters.quizId)) {
    query.quizId = new ObjectId(filters.quizId);
  }
  if (filters.courseId && ObjectId.isValid(filters.courseId)) {
    query.courseId = new ObjectId(filters.courseId);
  }
  if (filters.chapterId && ObjectId.isValid(filters.chapterId)) {
    query.chapterId = new ObjectId(filters.chapterId);
  }
  if (filters.difficulty) query.difficulty = filters.difficulty;
  if (filters.batchNumber) query.batchNumber = filters.batchNumber;
  return query;
};

export const generateAndSaveQuestions = async ({ courseId, chapterId, quizId, courseTitle, chapterTitle }) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured. Set OPENAI_API_KEY in .env');
  }

  // Find a lesson with a video first, then fall back to any lesson for description
  const lessonWithVideo = await Topic.findOne({
    chapterId,
    video_type: 'lesson',
    videoUrl: { $nin: [null, ''] },
    deletedAt: null,
    status: 'active',
  }).sort({ order: 1 }).lean();

  const anyLesson = lessonWithVideo || await Topic.findOne({
    chapterId,
    video_type: 'lesson',
    deletedAt: null,
    status: 'active',
  }).sort({ order: 1 }).lean();

  // Video → MP3 → transcript (cached on the lesson; usually already made right after
  // upload). Null when the video isn't a local upload — then title/description are used.
  let transcript = null;
  if (lessonWithVideo?.videoUrl) {
    try {
      transcript = limitTranscript(await getLessonTranscript(lessonWithVideo)) || null;
    } catch (err) {
      if (err.statusCode) throw err; // e.g. 409: the video is still being converted
      throw new Error(`Could not create the lesson script from the video: ${err.message}`);
    }
  }

  // Build the best available text context for generation
  const lessonDesc = anyLesson?.desc?.trim() || '';
  const lessonTitle = anyLesson?.title?.trim() || '';

  if (!transcript && !lessonDesc && !lessonTitle) {
    throw new Error('No lesson content found. Please add a lesson with a video or description before generating quiz questions.');
  }

  let contentSection;
  if (transcript) {
    contentSection = `LESSON TRANSCRIPT:\n"""\n${transcript}\n"""`;
  } else {
    const lines = [
      `Course: ${courseTitle}`,
      `Chapter: ${chapterTitle}`,
      lessonTitle  ? `Lesson: ${lessonTitle}` : '',
      lessonDesc   ? `Description:\n${lessonDesc}` : '',
    ].filter(Boolean).join('\n');
    contentSection = `LESSON CONTENT:\n"""\n${lines}\n"""`;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `You are an expert educator. Based on the following lesson content, generate exactly 50 short-answer questions.

${contentSection}

Requirements:
- 20 beginner questions (fundamental concepts, basic recall from the content)
- 20 intermediate questions (application and understanding of the content)
- 10 advanced questions (analysis, synthesis, and deeper understanding)
- Each question must have a clear text-based answer (1–4 sentences; no multiple-choice options)
- Answers should be concise but complete — a learner reading the answer should fully understand the concept
- Questions must be directly based on the provided content
${ENGLISH_ONLY_RULE}

Return ONLY a valid JSON array (no markdown fences, no extra text) in this exact format:
[
  {
    "question": "Question text?",
    "answer": "A clear, concise text answer to the question.",
    "difficulty": "beginner",
    "explanation": "Optional extra context or elaboration on the answer."
  }
]`;

  // English only, even when the lesson video was spoken in Hindi (see _helpers/qaEnglish.js).
  const questions = await generateEnglishQuestions({
    client,
    systemText: 'You are an expert educator. Return ONLY a valid JSON array, no markdown.',
    prompt,
    options: { model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 10000 },
  });

  const lastBatch = await QuizQuestion.findOne(
    { quizId, deletedAt: null },
    { batchNumber: 1 },
    { sort: { batchNumber: -1 } }
  ).lean();
  const batchNumber = (lastBatch?.batchNumber || 0) + 1;

  const VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
  const docs = questions.map(q => ({
    courseId, chapterId, quizId,
    question: q.question || '',
    answer: q.answer || '',
    options: [],
    difficulty: VALID_DIFFICULTIES.includes(q.difficulty) ? q.difficulty : 'beginner',
    explanation: q.explanation || '',
    batchNumber,
    status: 'generated',
    deletedAt: null,
  }));

  return await QuizQuestion.insertMany(docs);
};

export const createQuestion = async (data) => {
  try {
    return await new QuizQuestion({
      courseId: data.courseId,
      chapterId: data.chapterId,
      quizId: data.quizId,
      question: data.question,
      answer: data.answer || '',
      options: data.options || [],
      difficulty: data.difficulty,
      explanation: data.explanation || '',
      batchNumber: data.batchNumber || 1,
      status: 'created',
    }).save();
  } catch (error) {
    throw error;
  }
};

export const editQuestion = async (editId) => {
  try {
    return await QuizQuestion.findOne({ _id: editId, deletedAt: null }).lean();
  } catch (error) {
    throw error;
  }
};

export const updateQuestion = async (updateId, data) => {
  try {
    const fields = [
      'courseId', 'chapterId', 'quizId', 'question', 'answer',
      'options', 'difficulty', 'explanation', 'batchNumber'
    ];
    const updateFields = {};
    for (const field of fields) {
      if (data[field] !== undefined) updateFields[field] = data[field];
    }

    if (Object.keys(updateFields).length === 0) {
      return await QuizQuestion.findOne({ _id: updateId, deletedAt: null }).lean();
    }

    updateFields.updatedAt = new Date();

    return await QuizQuestion.findOneAndUpdate(
      { _id: updateId, deletedAt: null },
      { $set: updateFields },
      { returnDocument: 'before', runValidators: true }
    ).lean();
  } catch (error) {
    throw error;
  }
};

export const listQuestions = async (filters = {}) => {
  try {
    const query = buildQuery(filters);
    return await QuizQuestion.find(query).sort({ batchNumber: 1, createdAt: 1 }).lean();
  } catch (error) {
    throw error;
  }
};

// Learner-facing question list for a chapter quiz: restricts to the admin-curated
// selection pool (Topic.quizSettings.selectedQuestionIds, falling back to every active
// question for the quiz if nothing was explicitly selected), then takes a rounded
// percentage from EACH difficulty tier's OWN selected count according to the learner's
// aptitude level for this course — e.g. at Intermediate level (10/80/10), 42 selected
// Intermediate questions contribute round(42 * 0.80) = 34, independent of how many
// Basic/Advanced questions exist. Because a percentage of a count can never round above
// that same count, no tier can ever come up short against its own target — the totals
// simply add up to whatever the three tiers' roundings produce. If the course has no
// aptitude test enabled, or no aptitude attempt is on record yet, the pool is returned
// unfiltered — the level-based split only ever applies once a per-course level exists.
export const listQuestionsForLearner = async ({ quizId, userId }) => {
  try {
    if (!quizId || !ObjectId.isValid(quizId)) return [];

    // Topic lookup and pool lookup are independent of each other (pool only needs
    // quizId, not the topic doc) — run them in parallel instead of sequentially.
    const [topic, pool0] = await Promise.all([
      Topic.findById(quizId).select('courseId quizSettings').lean(),
      QuizQuestion.find(buildQuery({ quizId })).sort({ batchNumber: 1, createdAt: 1 }).lean(),
    ]);
    const selectedIds = Array.isArray(topic?.quizSettings?.selectedQuestionIds)
      ? topic.quizSettings.selectedQuestionIds.map(String)
      : [];

    let pool = pool0;
    // The Final Course Assignment has no questions of its own: its selection is picked
    // from the course's other chapter quizzes, so load those questions by id instead.
    if (topic?.quizSettings?.isFinalAssignment) {
      const ids = selectedIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
      pool = ids.length
        ? await QuizQuestion.find({ ...buildQuery({ courseId: String(topic.courseId) }), _id: { $in: ids } })
          .sort({ batchNumber: 1, createdAt: 1 }).lean()
        : [];
    }
    if (selectedIds.length > 0) {
      const selectedSet = new Set(selectedIds);
      pool = pool.filter(q => selectedSet.has(String(q._id)));
    }

    const settings = normalizeQuizSettings(topic?.quizSettings);
    const level = await resolveAptitudeLevel({ userId, courseId: topic?.courseId });
    if (!level) return applyOrderAndLimit(pool, settings);

    const byTier = { beginner: [], intermediate: [], advanced: [] };
    for (const q of pool) {
      const tier = String(q.difficulty || '').toLowerCase();
      if (byTier[tier]) byTier[tier].push(q);
    }

    const pcts = LEVEL_DIFFICULTY_SPLIT[level];
    return applyOrderAndLimit(DIFFICULTY_TIERS.flatMap(tier => {
      const available = byTier[tier].length;
      if (available === 0) return [];
      // A small selected count can round all the way down to 0 (e.g. 4 Advanced x 10% =
      // 0.4). Rather than let a tier vanish entirely when it has any questions selected
      // and the level assigns it a nonzero share, guarantee at least 1 from it.
      const take = pcts[tier] > 0
        ? Math.max(1, Math.round(available * pcts[tier]))
        : Math.round(available * pcts[tier]);
      return byTier[tier].slice(0, take);
    }), settings);
  } catch (error) {
    throw error;
  }
};

// Quiz settings → Question Order + Max Question Allowed to Answer.
// Sequential keeps the builder's order (Basic → Intermediate → Advanced);
// Random shuffles, so a max below the pool size also picks a random subset.
function applyOrderAndLimit(questions, settings) {
  const rank = q => {
    const i = DIFFICULTY_TIERS.indexOf(String(q.difficulty || '').toLowerCase());
    return i === -1 ? 1 : i;
  };
  let ordered;
  if (settings.questionOrder === 'sequential') {
    ordered = questions.map((q, i) => ({ q, i }))
      .sort((a, b) => rank(a.q) - rank(b.q) || a.i - b.i)
      .map(x => x.q);
  } else {
    ordered = [...questions];
    for (let i = ordered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    }
  }
  return settings.maxQuestions > 0 ? ordered.slice(0, settings.maxQuestions) : ordered;
}

async function resolveAptitudeLevel({ userId, courseId }) {
  if (!userId || !courseId) return null;
  const course = await Course.findById(courseId).select('aptitudeEnabled').lean();
  if (!course?.aptitudeEnabled) return null;

  const attempt = await AptitudeAttempt.findOne({ userId, courseId })
    .sort({ createdAt: -1 })
    .select('level')
    .lean();
  return attempt?.level && LEVEL_DIFFICULTY_SPLIT[attempt.level] ? attempt.level : null;
}

export const listQuestionsPagination = async (page, limit, filters = {}) => {
  try {
    const query = buildQuery(filters);
    return await QuizQuestion.find(query)
      .sort({ batchNumber: 1, createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
  } catch (error) {
    throw error;
  }
};

export const getQuestionCount = async (filters = {}) => {
  try {
    const query = buildQuery(filters);
    return await QuizQuestion.countDocuments(query);
  } catch (error) {
    throw error;
  }
};

export const deleteQuestion = async (delId) => {
  try {
    return await QuizQuestion.findOneAndUpdate(
      { _id: delId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { returnDocument: 'before' }
    ).lean();
  } catch (error) {
    throw error;
  }
};

// Bulk permanent delete (Generated QA: tick questions → "Delete"): removes the question
// documents and drops their ids from any quiz topic's saved selection.
export const permanentDeleteQuestions = async (ids) => {
  const oids = [...new Set((ids || []).map(String))]
    .filter(id => mongoose.isValidObjectId(id))
    .map(id => new mongoose.Types.ObjectId(id));
  if (!oids.length) return { deletedCount: 0 };
  const { deletedCount } = await QuizQuestion.deleteMany({ _id: { $in: oids } });
  const both = [...oids, ...oids.map(String)]; // selections may hold ids as ObjectId or string
  await Topic.updateMany(
    { 'quizSettings.selectedQuestionIds': { $in: both } },
    { $pull: { 'quizSettings.selectedQuestionIds': { $in: both } } }
  );
  return { deletedCount };
};

// Permanent delete (Generated QA "delete" icon): removes the question document
// and drops its id from any quiz topic's saved selection.
export const permanentDeleteQuestion = async (delId) => {
  const oid = new mongoose.Types.ObjectId(delId);
  const deleted = await QuizQuestion.findOneAndDelete({ _id: oid }).lean();
  if (!deleted) return null;
  await Topic.updateMany(
    { 'quizSettings.selectedQuestionIds': { $in: [oid, String(oid)] } },
    { $pull: { 'quizSettings.selectedQuestionIds': { $in: [oid, String(oid)] } } }
  );
  return deleted;
};
