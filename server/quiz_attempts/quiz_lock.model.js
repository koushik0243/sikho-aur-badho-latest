import mongoose from 'mongoose';

// Per learner + course activity locks. Quizzes and lesson videos are mutually
// exclusive across tabs and devices:
//   QuizLock  — "this learner is taking a quiz in this course right now";
//               while held, the course's lesson videos are locked.
//   VideoLock — "this learner is playing a lesson video in this course";
//               while held, the course's quizzes can't be started.
// The holding tab refreshes expiresAt with a heartbeat. If it stops (closed,
// crashed, offline) the lock lapses on its own — readers ignore anything past
// expiresAt, and the TTL index below deletes stale documents. ownerId is the
// holding tab's id, so a tab can ignore its own lock.
function buildLockSchema() {
  const schema = new mongoose.Schema({
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    courseId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    topicId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Topic',  required: true },
    ownerId:   { type: String, default: null },
    expiresAt: { type: Date, required: true },
  }, { timestamps: true });

  schema.index({ userId: 1, courseId: 1 }, { unique: true });
  schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return schema;
}

export const VideoLock = mongoose.model('VideoLock', buildLockSchema(), 'video_locks');

export default mongoose.model('QuizLock', buildLockSchema(), 'quiz_locks');
