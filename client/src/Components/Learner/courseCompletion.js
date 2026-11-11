import apiServiceHandler from '../../service/apiService';

// The learner's permanent certificate record for a course (server-side). Once it
// exists the course stays complete even if the admin later adds chapters; its
// chapterIds list the chapters the course had at completion.

function recordFrom(res) {
  const rec = res && typeof res === 'object' && 'data' in res ? res.data : res;
  return rec?._id ? rec : null;
}

/** @returns {Promise<object|null>} the completion record, or null if not earned */
export async function fetchCourseCompletion(courseId) {
  // Timestamp defeats apiServiceHandler's 60s GET cache.
  const res = await apiServiceHandler('GET', `course-completion?courseId=${courseId}&t=${Date.now()}`)
    .catch(() => null);
  return recordFrom(res);
}

/** Records the certificate (the server re-checks completion). @returns {Promise<object|null>} */
export async function recordCourseCompletion(courseId) {
  const res = await apiServiceHandler('POST', 'course-completion/complete', { courseId }).catch(() => null);
  return recordFrom(res);
}

/** Set of chapter ids the course had when the certificate was earned. */
export function completedChapterIdSet(completion) {
  return new Set((completion?.chapterIds || []).map(String));
}
