import mongoose from 'mongoose';
import Progress from './progress.model.js';

// A lesson video counts as watched once the learner is within this many seconds
// of the end (end credits / sign-off), not at a percentage of its length.
const COMPLETE_BEFORE_END_SECS = 30;
// For short videos the fixed window would be most of the video, so require at
// least this share of it to have been watched.
const MIN_COMPLETE_RATIO = 0.9;

function completionThreshold(durationSeconds) {
  return Math.max(durationSeconds - COMPLETE_BEFORE_END_SECS, durationSeconds * MIN_COMPLETE_RATIO);
}

export const updateProgress = async ({ userId, courseId, topicId, watchedSeconds, durationSeconds, lastPosition }) => {
  // Completion gates the next topic in the chapter, so it must never regress —
  // re-watching a finished video from the start reports a low watchedSeconds.
  const existing = await Progress.findOne({ userId, topicId }).select('watchedSeconds completed').lean();
  const bestWatched = Math.max(Math.floor(watchedSeconds), existing?.watchedSeconds || 0);
  const pct = durationSeconds > 0 ? Math.min(100, Math.round((bestWatched / durationSeconds) * 100)) : 0;
  const completed = existing?.completed === true
    || (durationSeconds > 0 && bestWatched >= completionThreshold(durationSeconds));

  return await Progress.findOneAndUpdate(
    { userId, topicId },
    {
      userId, courseId, topicId,
      watchedSeconds:  bestWatched,
      durationSeconds: Math.floor(durationSeconds),
      percentage:      pct,
      lastPosition:    Math.floor(lastPosition ?? watchedSeconds),
      completed,
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).lean();
};

export const getCourseProgress = async ({ userId, courseId }) => {
  const records = await Progress.find({
    userId,
    courseId: new mongoose.Types.ObjectId(courseId),
  }).lean();

  const totalDuration = records.reduce((s, r) => s + (r.durationSeconds || 0), 0);
  const totalWatched  = records.reduce((s, r) => s + Math.min(r.watchedSeconds || 0, r.durationSeconds || 0), 0);
  const overallPercent = totalDuration > 0 ? Math.min(100, Math.round((totalWatched / totalDuration) * 100)) : 0;

  return { overallPercent, topics: records };
};
