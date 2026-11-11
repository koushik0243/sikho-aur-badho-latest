import mongoose from 'mongoose';
import CourseCompletion from './course_completion.model.js';
import Chapter from '../chapters/chapter.model.js';
import Topic from '../topics/topic.model.js';
import Progress from '../progress/progress.model.js';
import QuizAttempt from '../quiz_attempts/quiz_attempt.model.js';
import TopicActivity, { HOMEWORK_DONE_FILTER } from '../topic_activity/topic_activity.model.js';

const { ObjectId } = mongoose.Types;

export const getCompletion = async ({ userId, courseId }) =>
  CourseCompletion.findOne({ userId, courseId }).lean();

export const listCompletions = async ({ userId }) =>
  CourseCompletion.find({ userId }).select('courseId completedAt').lean();

// Same content the learner player shows: live chapters and their topics.
async function loadCourseContent(courseId) {
  const cid = new ObjectId(courseId);
  const chapters = await Chapter.find({ courseId: cid, deletedAt: null, status: { $ne: 'inactive' } })
    .select('_id').lean();
  const chapterIds = chapters.map(c => String(c._id));
  const topics = await Topic.find({ courseId: cid, deletedAt: null, chapterId: { $in: chapterIds } })
    .select('_id chapterId video_type videoUrl').lean();
  return { chapterIds, topics };
}

const topicKind = (t) => {
  const vt = String(t.video_type || '').toLowerCase().trim();
  if (vt === 'zoom_link') return 'zoom';
  if (vt === 'quiz' || vt === 'assignment') return vt;
  return 'lesson';
};

// Server-side check: every lesson video watched, every quiz passed and every
// assignment approved by a reviewer. (Zoom sessions have no completion signal.)
async function verifyCourseDone({ userId, courseId, topics, chapterIds }) {
  if (chapterIds.length === 0 || topics.length === 0) return false;
  const lessonIds = topics.filter(t => topicKind(t) === 'lesson' && t.videoUrl).map(t => t._id);
  const quizIds   = topics.filter(t => topicKind(t) === 'quiz').map(t => t._id);
  const homeworkIds = topics.filter(t => topicKind(t) === 'assignment').map(t => t._id);
  const [watched, passed, approved] = await Promise.all([
    lessonIds.length
      ? Progress.countDocuments({ userId, topicId: { $in: lessonIds }, completed: true })
      : 0,
    quizIds.length
      ? QuizAttempt.distinct('topicId', { userId, topicId: { $in: quizIds }, passed: true })
      : [],
    homeworkIds.length
      ? TopicActivity.distinct('topicId', { userId, topicId: { $in: homeworkIds }, type: 'assignment_done', ...HOMEWORK_DONE_FILTER })
      : [],
  ]);
  return watched === lessonIds.length && passed.length === quizIds.length && approved.length === homeworkIds.length;
}

/**
 * Records the certificate the first time the course is completed. An existing
 * record is returned unchanged — the certificate is permanent.
 * @returns {Promise<{ record: object|null, reason?: string }>}
 */
export const markCourseComplete = async ({ userId, courseId }) => {
  const existing = await getCompletion({ userId, courseId });
  if (existing) return { record: existing };

  const { chapterIds, topics } = await loadCourseContent(courseId);
  const done = await verifyCourseDone({ userId, courseId, topics, chapterIds });
  if (!done) return { record: null, reason: 'Course is not complete yet.' };

  const record = await CourseCompletion.findOneAndUpdate(
    { userId, courseId },
    {
      $setOnInsert: {
        userId, courseId,
        completedAt: new Date(),
        chapterIds,
        topicIds: topics.map(t => t._id),
      },
    },
    { upsert: true, returnDocument: 'after' }
  ).lean();
  return { record };
};

/**
 * A learner's certificate status for one course, for the store owner / super
 * admin certificate page. Read-only — it never records a completion (only the
 * learner's own course/certificate page does that).
 * Completed = the learner's saved certificate record, or else every lesson
 * watched AND every quiz passed in a course that has at least one quiz (so a
 * course with nothing to pass can't count as completed by someone who never
 * opened it, and a completed course always has a score).
 * @returns {Promise<{ completed: boolean, completedAt: Date|null, score: number|null,
 *   attempted: boolean, quizzesPassed: number, quizzesTotal: number }>}
 */
export const getLearnerCourseStatus = async ({ userId, courseId }) => {
  const uid = new ObjectId(userId);
  const cid = new ObjectId(courseId);
  const record = await getCompletion({ userId: uid, courseId: cid });
  const { topics, chapterIds } = await loadCourseContent(courseId);
  const quizIds = topics.filter(t => topicKind(t) === 'quiz').map(t => t._id);

  const attempts = await QuizAttempt.find({ userId: uid, courseId: cid })
    .select('topicId totalScore passed evaluatedAt createdAt').lean();
  const quizSet = new Set(quizIds.map(String));
  const bestPassed = new Map(); // quiz topicId → best passing score
  let latestPassAt = null;
  for (const a of attempts) {
    const tid = String(a.topicId);
    if (!a.passed || !quizSet.has(tid)) continue;
    bestPassed.set(tid, Math.max(bestPassed.get(tid) ?? 0, Number(a.totalScore) || 0));
    const at = new Date(a.evaluatedAt || a.createdAt);
    if (!latestPassAt || at > latestPassAt) latestPassAt = at;
  }

  const verified = !record && quizIds.length > 0
    && await verifyCourseDone({ userId: uid, courseId: cid, topics, chapterIds });
  const completed = !!record || verified;
  const scores = [...bestPassed.values()];
  return {
    completed,
    completedAt: record?.completedAt || (verified ? latestPassAt : null),
    score: completed && scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null,
    attempted: attempts.length > 0,
    quizzesPassed: bestPassed.size,
    quizzesTotal: quizIds.length,
    lastPassedAt: latestPassAt,
  };
};
