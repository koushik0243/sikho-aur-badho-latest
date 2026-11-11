import fsp from 'fs/promises';
import Topic from '../topics/topic.model.js';
import Course from '../courses/course.model.js';
import { resolveUploadPath } from './videoConvert.js';

/**
 * Removes uploaded video files from disk (public/uploads) when lessons, chapters or
 * courses are deleted. A file is only removed when no live (not deleted) lesson or
 * course still points at it, so a file shared by two records is kept until both are gone.
 * External links (YouTube, Vimeo, …) are never touched.
 */

// What a deleted lesson keeps of its video: nothing. Clearing the path (not only the file)
// also stops a conversion that is still running from saving into the deleted lesson —
// it then throws both its input and its output away (videoConvert.js convertAndSwap).
export const CLEARED_LESSON_VIDEO = {
  videoUrl: null,
  videoStatus: null,
  transcript: null,
  transcriptVideoUrl: null,
  transcriptStatus: null,
  transcriptError: null,
};

export const CLEARED_INTRO_VIDEO = {
  intro_video: null,
  introVideoStatus: null,
};

async function isStillUsed(url) {
  const [lesson, course] = await Promise.all([
    Topic.exists({ deletedAt: null, videoUrl: url }),
    Course.exists({ deletedAt: null, $or: [{ intro_video: url }, { intro_video_url: url }] }),
  ]);
  return Boolean(lesson || course);
}

/**
 * Deletes the given uploaded video files.
 * @param {(string|null|undefined)[]} urls stored paths, e.g. "uploads/videos/abc.mp4"
 * @returns {Promise<number>} how many files were removed
 */
export async function deleteVideoFiles(urls) {
  const unique = [...new Set((urls || []).filter(u => typeof u === 'string' && u.trim()))];
  let removed = 0;
  for (const url of unique) {
    const file = resolveUploadPath(url);
    if (!file) continue; // external link, or the file is already gone
    try {
      if (await isStillUsed(url)) continue;
      await fsp.rm(file, { force: true });
      removed += 1;
    } catch (err) {
      // The record is already deleted; a file that couldn't be removed is only wasted space.
      console.error(`[deleteVideoFiles] could not remove ${url}:`, err.message);
    }
  }
  return removed;
}

/**
 * Soft-deletes every live lesson matching `filter`, clears their video fields and removes
 * their video files.
 * @param {object} filter e.g. { chapterId } or { courseId }
 * @param {Date} deletedAt
 * @returns {Promise<string[]>} the video paths those lessons had (for a caller that removes
 *   more files in one go)
 */
export async function deleteLessonsWithVideos(filter, deletedAt = new Date()) {
  const lessons = await Topic.find({ ...filter, deletedAt: null }).select('videoUrl').lean();
  if (!lessons.length) return [];
  await Topic.updateMany(
    { _id: { $in: lessons.map(l => l._id) }, deletedAt: null },
    { $set: { deletedAt, status: 'inactive', ...CLEARED_LESSON_VIDEO } },
  );
  return lessons.map(l => l.videoUrl).filter(Boolean);
}
