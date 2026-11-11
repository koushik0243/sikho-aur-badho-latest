import mongoose from 'mongoose';
import QuizAttempt from '../quiz_attempts/quiz_attempt.model.js';
import AptitudeAttempt from '../aptitude_attempts/aptitude_attempt.model.js';
import CourseAssignment from '../course_assignments/course_assignment.model.js';
import TopicActivity from '../topic_activity/topic_activity.model.js';

const { ObjectId } = mongoose.Types;

const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' };

// Real per-learner activity timeline — merged from actual stored events (chapter quiz
// attempts, aptitude test attempts, course assignments). No placeholder/fake rows; a
// learner with no activity simply gets an empty array and the client shows its own
// honest empty state.
export const listActivity = async (userId) => {
  if (!userId || !ObjectId.isValid(userId)) {
    const err = new Error('A valid userId is required.');
    err.statusCode = 400;
    throw err;
  }
  const userObjId = new ObjectId(userId);

  const [quizAttempts, aptitudeAttempts, courseAssignments, reviewedHomework] = await Promise.all([
    QuizAttempt.find({ userId: userObjId })
      .sort({ createdAt: -1 }).limit(20)
      .populate('courseId', 'title')
      .populate('chapterId', 'title')
      .populate('topicId', 'title')
      .lean(),
    AptitudeAttempt.find({ userId: userObjId })
      .sort({ createdAt: -1 }).limit(20)
      .populate('courseId', 'title')
      .lean(),
    CourseAssignment.find({ userId: userObjId })
      .sort({ attemptedAt: -1 }).limit(20)
      .populate('courseId', 'title')
      .lean(),
    // Homework a reviewer marked complete or sent back for a new video
    TopicActivity.find({ userId: userObjId, type: 'assignment_done', 'review.status': { $in: ['approved', 'reupload'] } })
      .sort({ 'review.reviewedAt': -1 }).limit(20)
      .populate('courseId', 'title')
      .populate('topicId', 'title')
      .lean(),
  ]);

  const activity = [];

  quizAttempts.forEach(a => {
    const courseTitle = a.courseId?.title || 'Untitled Course';
    const topicTitle = a.topicId?.title || a.chapterId?.title || 'a chapter';
    activity.push({
      title: `Quiz ${a.passed ? 'Passed' : 'Attempted'} — ${topicTitle}`,
      description: `${courseTitle} · Score ${a.totalScore ?? 0}/100`,
      badge: a.passed ? 'PASSED' : 'FAILED',
      createdAt: a.createdAt,
    });
  });

  aptitudeAttempts.forEach(a => {
    const courseTitle = a.courseId?.title || 'Untitled Course';
    activity.push({
      title: `Aptitude Test Completed — ${courseTitle}`,
      description: `Score ${a.totalScore ?? 0}/100`,
      badge: LEVEL_LABEL[a.level] || null,
      createdAt: a.createdAt,
    });
  });

  courseAssignments.forEach(ca => {
    const courseTitle = ca.courseId?.title || 'Untitled Course';
    activity.push({
      title: 'New Course Assigned',
      description: courseTitle,
      badge: null,
      createdAt: ca.attemptedAt,
    });
  });

  reviewedHomework.forEach(r => {
    const courseTitle = r.courseId?.title || 'Untitled Course';
    const topicTitle = r.topicId?.title || 'Assignment';
    const reupload = r.review.status === 'reupload';
    activity.push({
      title: reupload ? `Re-upload requested — ${topicTitle}` : `Assignment approved — ${topicTitle}`,
      description: reupload && r.review.note ? `${courseTitle} · "${r.review.note}"` : courseTitle,
      badge: reupload ? 'RE-UPLOAD' : 'APPROVED',
      createdAt: r.review.reviewedAt || r.updatedAt,
    });
  });

  activity.sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
  return activity.slice(0, 20);
};
