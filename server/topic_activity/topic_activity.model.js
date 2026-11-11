import mongoose from 'mongoose';

// A learner's action on a course topic that has no other server record:
//   'assignment_done' — submitted a homework assignment (a video of the finished work;
//                       older records were a "Mark as Done" click and have no video)
//   'zoom_joined'     — clicked "Join" on a Zoom session
// One record per learner + topic + type. For homework it keeps every video the learner
// uploads (Video 1, 2, …), each with the reviewer's comment.

// The reviewer's comment on one video.
const VideoCommentSchema = new mongoose.Schema({
  note:         { type: String, default: '', maxlength: 1000 },
  status:       { type: String, enum: ['approved', 'reupload', ''], default: '' }, // decision given with it
  reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewerName: { type: String, default: '' },
  reviewedAt:   { type: Date, default: null },
}, { _id: false });

const SubmissionSchema = new mongoose.Schema({
  file:         { type: String, required: true },  // file name inside private/assignment-submissions
  originalName: { type: String, default: '' },
  mimeType:     { type: String, default: '' },
  size:         { type: Number, default: 0 },       // bytes
  uploadedAt:   { type: Date, default: Date.now },
  // Playback readiness (_helpers/videoConvert.js): 'processing' while a MOV/AVI/MKV… is
  // converted to a browser-safe MP4, then 'ready' (or 'failed'). Older videos have none = ready.
  status:       { type: String, enum: ['processing', 'ready', 'failed'], default: undefined },
  // Every comment a reviewer wrote on this video, oldest first.
  comments:     { type: [VideoCommentSchema], default: undefined },
  // The latest comment (older records only have this one).
  comment:      { type: VideoCommentSchema, default: null },
}, { _id: false });

const ReviewSchema = new mongoose.Schema({
  status:     { type: String, enum: ['pending', 'approved', 'reupload'], default: 'pending' },
  note:       { type: String, default: '', maxlength: 1000 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewerName: { type: String, default: '' },
  reviewedAt: { type: Date, default: null },
}, { _id: false });

const TopicActivitySchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', default: null },
  topicId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  type:      { type: String, enum: ['assignment_done', 'zoom_joined'], required: true },
  // Every video the learner uploaded for this assignment, oldest first (Video 1, Video 2, …).
  videos: { type: [SubmissionSchema], default: undefined },
  // The latest video (kept in step with videos[last]; older records only have this).
  submission: { type: SubmissionSchema, default: null },
  // Reviewer's decision on the homework (super admin or the learner's store owner).
  //   pending  — waiting for review (every new upload starts here)
  //   approved — marked complete (possible even without a video)
  //   reupload — the learner must upload a new video; the homework counts as NOT done meanwhile
  review: { type: ReviewSchema, default: null },
}, { timestamps: true });

TopicActivitySchema.index({ userId: 1, topicId: 1, type: 1 }, { unique: true });
TopicActivitySchema.index({ courseId: 1, type: 1 });
TopicActivitySchema.index({ type: 1, 'submission.uploadedAt': -1 });

/**
 * Homework counts as done only once a reviewer approved it. Records from before videos
 * were required (a plain "Mark as Done": no video, no review) still count, so nobody
 * loses progress. A video waiting for review, or sent back for a re-upload, does not.
 */
export const HOMEWORK_DONE_FILTER = { $or: [{ 'review.status': 'approved' }, { submission: null, review: null }] };
/** Same rule for queries that read every activity type (Zoom joins always count). */
export const ACTIVITY_COUNTS_FILTER = { $or: [{ type: { $ne: 'assignment_done' } }, ...HOMEWORK_DONE_FILTER.$or] };
/** Every video of a record, oldest first — older records only have `submission`. */
export const allVideos = (r) => (Array.isArray(r?.videos) && r.videos.length ? r.videos : (r?.submission ? [r.submission] : []));
/** In code: is this assignment_done record complete? */
export const isHomeworkDone = (r) => Boolean(r) && (r.review?.status === 'approved' || (!r.submission && !r.review));

export default mongoose.model('TopicActivity', TopicActivitySchema, 'topic_activities');
