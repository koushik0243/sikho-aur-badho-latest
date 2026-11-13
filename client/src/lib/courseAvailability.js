// A course deleted by the super admin stays visible to store owners and learners (so they
// know what happened to it) but is marked inactive and can't be opened or assigned.
// Mirrors server/_helpers/deletedCourse.js.

export const COURSE_DELETED_LABEL = 'Inactive';
export const COURSE_DELETED_NOTE = 'This course has been deleted and is no longer available.';
export const COURSE_UNAVAILABLE_ACTION = 'Not available';

/** True for a course object the super admin deleted (status "deleted" or a deletedAt date). */
export function isCourseDeleted(course) {
  if (!course || typeof course !== 'object') return false;
  return String(course.status || '').toLowerCase() === 'deleted' || Boolean(course.deletedAt);
}

/**
 * True when an API error says the course was deleted (the server answers 410 Gone).
 * apiService wraps POST/PUT errors (statusCode + message) but a failed GET rejects with the
 * raw axios error (response.status + response.data.message), so both shapes are checked.
 */
export function isCourseDeletedError(err) {
  const status = err?.statusCode ?? err?.response?.status;
  const message = err?.response?.data?.message || err?.message || '';
  return status === 410 || /has been deleted/i.test(String(message));
}
