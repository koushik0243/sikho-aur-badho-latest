import mongoose from 'mongoose';
import Course from '../courses/course.model.js';
import Chapter from '../chapters/chapter.model.js';

/**
 * A course deleted by the super admin stays in the database (soft delete): store owners and
 * learners still see it in their lists, marked inactive, and keep every record tied to it
 * (assignments, credits, progress, quiz results, certificates). What they can no longer do is
 * open it, read its chapters or lessons, or assign it again. These helpers enforce that.
 */

export const DELETED_COURSE_MESSAGE = 'This course has been deleted and is no longer available.';

const { ObjectId } = mongoose.Types;

/** 410 Gone error for a deleted course (the API error handler sends statusCode + message). */
export function deletedCourseError() {
  const err = new Error(DELETED_COURSE_MESSAGE);
  err.statusCode = 410;
  return err;
}

/** True when the course exists but was deleted. */
export async function isCourseDeleted(courseId) {
  if (!courseId || !ObjectId.isValid(String(courseId))) return false;
  const course = await Course.findById(courseId).select('deletedAt status').lean();
  return Boolean(course && (course.deletedAt || course.status === 'deleted'));
}

/** Throws a 400 for a missing course and a 410 for a deleted one; used before assigning. */
export async function assertCourseAvailable(courseId) {
  if (!courseId || !ObjectId.isValid(String(courseId))) {
    const err = new Error('A valid course is required.');
    err.statusCode = 400;
    throw err;
  }
  const course = await Course.findById(courseId).select('deletedAt status').lean();
  if (!course) {
    const err = new Error('Course not found.');
    err.statusCode = 404;
    throw err;
  }
  if (course.deletedAt || course.status === 'deleted') throw deletedCourseError();
}

/** True when the chapter belongs to a deleted course (for lesson lists filtered by chapter). */
export async function isChapterOfDeletedCourse(chapterId) {
  if (!chapterId || !ObjectId.isValid(String(chapterId))) return false;
  const chapter = await Chapter.findById(chapterId).select('courseId').lean();
  return chapter ? isCourseDeleted(chapter.courseId) : false;
}
