import mongoose from 'mongoose';
import OpenAI from 'openai';
import AptitudeQuestion from './aptitude_question.model.js';
import Course from '../courses/course.model.js';
import { getCourseTranscripts, limitTranscript } from '../topics/topic.transcript.js';
import { ENGLISH_ONLY_RULE, generateEnglishQuestions } from '../_helpers/qaEnglish.js';

const { ObjectId } = mongoose.Types;

// QA origin: 'generated' (AI) or 'created' (hand-written by a super admin).
export const QA_STATUSES = ['generated', 'created'];

const buildQuery = (filters = {}) => {
  const query = { deletedAt: null };
  if (QA_STATUSES.includes(filters.status)) query.status = filters.status;
  if (filters.courseId && ObjectId.isValid(filters.courseId)) {
    query.courseId = new ObjectId(filters.courseId);
  }
  if (filters.difficulty) query.difficulty = filters.difficulty;
  if (filters.batchNumber) query.batchNumber = filters.batchNumber;
  return query;
};

// Transcripts of the course's lesson videos (video → MP3 → script), joined for the
// prompt. A course that isn't saved yet (no courseId) has none.
async function buildLessonScripts(courseId) {
  if (!courseId || !ObjectId.isValid(courseId)) return { text: '', pendingCount: 0 };
  const { transcripts, pendingCount } = await getCourseTranscripts(new ObjectId(courseId));
  const text = transcripts.map(t => `Lesson: ${t.title}\n${t.transcript}`).join('\n\n');
  return { text: limitTranscript(text), pendingCount };
}

export const generateAndSaveQuestions = async ({ courseId, courseTitle, courseDesc, context }) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured. Set OPENAI_API_KEY in .env');
  }

  const trimmedContext = (context || '').trim();
  const lessonScripts = await buildLessonScripts(courseId);
  if (!trimmedContext && !lessonScripts.text) {
    const err = new Error(lessonScripts.pendingCount
      ? 'The lesson video scripts are still being prepared. Try again in a few minutes, or enter context.'
      : 'Please enter context, or add lesson videos to this course, before generating aptitude questions.');
    err.statusCode = 400;
    throw err;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const contentSection = [
    courseTitle ? `Course: ${courseTitle}` : '',
    courseDesc ? `Description:\n${courseDesc}` : '',
    trimmedContext ? `CONTEXT:\n"""\n${trimmedContext}\n"""` : '',
    lessonScripts.text ? `LESSON VIDEO TRANSCRIPTS:\n"""\n${lessonScripts.text}\n"""` : '',
  ].filter(Boolean).join('\n');

  const prompt = `You are an expert aptitude-test author. Based on the following context, generate exactly 50 short-answer aptitude questions.

${contentSection}

Requirements:
- 20 beginner questions (fundamental concepts, basic recall from the content)
- 20 intermediate questions (application and understanding of the content)
- 10 advanced questions (analysis, synthesis, and deeper understanding)
- Each question must have a clear text-based answer (1–4 sentences; no multiple-choice options)
- Answers should be concise but complete — a learner reading the answer should fully understand the concept
- Questions must be directly based on the provided context
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

  // English only, even when lesson transcripts are in Hindi (see _helpers/qaEnglish.js).
  const questions = await generateEnglishQuestions({
    client,
    systemText: 'You are an expert aptitude-test author. Return ONLY a valid JSON array, no markdown.',
    prompt,
    options: { model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 10000 },
  });

  const batchFilter = { deletedAt: null };
  if (courseId && ObjectId.isValid(courseId)) batchFilter.courseId = new ObjectId(courseId);
  else batchFilter.courseId = null;

  const lastBatch = await AptitudeQuestion.findOne(
    batchFilter,
    { batchNumber: 1 },
    { sort: { batchNumber: -1 } }
  ).lean();
  const batchNumber = (lastBatch?.batchNumber || 0) + 1;

  const VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
  const docs = questions.map(q => ({
    courseId: courseId && ObjectId.isValid(courseId) ? courseId : null,
    question: q.question || '',
    answer: q.answer || '',
    difficulty: VALID_DIFFICULTIES.includes(q.difficulty) ? q.difficulty : 'beginner',
    explanation: q.explanation || '',
    batchNumber,
    status: 'generated',
    deletedAt: null,
  }));

  return await AptitudeQuestion.insertMany(docs);
};

export const listQuestions = async (filters = {}) => {
  try {
    const query = buildQuery(filters);
    return await AptitudeQuestion.find(query).sort({ batchNumber: 1, createdAt: 1 }).lean();
  } catch (error) {
    throw error;
  }
};

export const attachCourseId = async (ids, courseId) => {
  try {
    const validIds = (ids || []).filter(id => ObjectId.isValid(id));
    if (!validIds.length || !ObjectId.isValid(courseId)) return { modifiedCount: 0 };
    return await AptitudeQuestion.updateMany(
      { _id: { $in: validIds }, deletedAt: null },
      { $set: { courseId, updatedAt: new Date() } }
    );
  } catch (error) {
    throw error;
  }
};

// A hand-written question added by an admin in the course builder. courseId is
// optional: like generated questions, it's attached on "Save Aptitude Test".
export const createQuestion = async (data) => {
  return await new AptitudeQuestion({
    courseId: data.courseId && ObjectId.isValid(data.courseId) ? data.courseId : null,
    question: data.question,
    answer: data.answer || '',
    difficulty: data.difficulty,
    explanation: data.explanation || '',
    status: 'created',
  }).save();
};

export const updateQuestion = async (updateId, data) => {
  const fields = ['question', 'answer', 'difficulty', 'explanation']; // status is fixed at creation
  const updateFields = {};
  for (const field of fields) {
    if (data[field] !== undefined) updateFields[field] = data[field];
  }
  if (Object.keys(updateFields).length === 0) {
    return await AptitudeQuestion.findOne({ _id: updateId, deletedAt: null }).lean();
  }
  return await AptitudeQuestion.findOneAndUpdate(
    { _id: updateId, deletedAt: null },
    { $set: { ...updateFields, updatedAt: new Date() } },
    { returnDocument: 'after', runValidators: true }
  ).lean();
};

// Bulk permanent delete (Generated QA: tick questions → "Delete"): removes the question
// documents and drops their ids from any course's saved aptitude selection.
export const permanentDeleteQuestions = async (ids) => {
  const oids = [...new Set((ids || []).map(String))]
    .filter(id => ObjectId.isValid(id))
    .map(id => new ObjectId(id));
  if (!oids.length) return { deletedCount: 0 };
  const { deletedCount } = await AptitudeQuestion.deleteMany({ _id: { $in: oids } });
  await Course.updateMany(
    { aptitudeSelectedQuestionIds: { $in: oids } },
    { $pull: { aptitudeSelectedQuestionIds: { $in: oids } } }
  );
  return { deletedCount };
};

// Permanent delete (Generated QA "delete" icon): removes the question document
// and drops its id from any course's saved aptitude selection.
export const permanentDeleteQuestion = async (delId) => {
  const oid = new ObjectId(delId);
  const deleted = await AptitudeQuestion.findOneAndDelete({ _id: oid }).lean();
  if (!deleted) return null;
  await Course.updateMany(
    { aptitudeSelectedQuestionIds: oid },
    { $pull: { aptitudeSelectedQuestionIds: oid } }
  );
  return deleted;
};
