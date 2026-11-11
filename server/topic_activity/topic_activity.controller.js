import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import TopicActivity, { isHomeworkDone, allVideos } from './topic_activity.model.js';
import { sendEmail } from '../_helpers/sendEmail.js';
import {
  initialVideoStatus, queueConversion, isAllowedVideoName,
  ALLOWED_VIDEO_FORMATS_LABEL, MAX_VIDEO_BYTES, MAX_VIDEO_LABEL,
} from '../_helpers/videoConvert.js';

// Learner-side records of homework submitted and Zoom sessions joined
// (mounted behind `protect`; a learner can only record / read their own).
// Homework is submitted as a video of the finished work (≤ 2 GB). The videos are kept
// outside /public and streamed only to: the learner who sent it, a super admin, or the
// store owner of the learner's organization.
const Router = express.Router();

const TYPE_FOR_TOPIC = { assignment: 'assignment_done', zoom_link: 'zoom_joined' };
const isId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const badRequest = (res, message) => res.status(400).json({ status: 400, message });
const forbidden = (res, message = 'You cannot view this submission.') => res.status(403).json({ status: 403, message });

// ── Submission video storage ──────────────────────────────────────────────────
// The app-wide video rule (videoConvert.js): MP4, WebM, MOV, AVI or MKV, up to 2 GB.
// Uploads this large rely on server.requestTimeout in app.js (Node's 5-minute default
// would cut them off). Videos that don't play in every browser are converted to MP4.
export const MAX_SUBMISSION_BYTES = MAX_VIDEO_BYTES;
const MAX_SUBMISSION_LABEL = MAX_VIDEO_LABEL;
export const MAX_VIDEOS_PER_ASSIGNMENT = 50;     // the highest "How many videos can upload?" allowed
export const DEFAULT_VIDEOS_PER_ASSIGNMENT = 10; // assignments saved before the field existed
/** The most videos a learner can ever upload for this assignment ("How many videos can upload?"). */
const videoLimit = (topic) => {
  const n = Number(topic?.maxVideos);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_VIDEOS_PER_ASSIGNMENT) : DEFAULT_VIDEOS_PER_ASSIGNMENT;
};
const limitMessage = (limit) => `You can upload only ${limit} video${limit === 1 ? '' : 's'} for this assignment.`;
const SUBMISSION_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'private', 'assignment-submissions');

const submissionUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { fs.mkdirSync(SUBMISSION_DIR, { recursive: true }); cb(null, SUBMISSION_DIR); },
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  // By extension only: browsers often send an empty or generic type for .mkv/.avi.
  // The file's content is checked with ffmpeg after upload (submitAssignment).
  fileFilter: (req, file, cb) => {
    if (isAllowedVideoName(file.originalname)) return cb(null, true);
    const err = new Error(`Please upload a video in ${ALLOWED_VIDEO_FORMATS_LABEL} format.`);
    err.statusCode = 400;
    cb(err);
  },
  limits: { fileSize: MAX_SUBMISSION_BYTES, files: 1 },
}).single('video');

const removeFile = (name) => { if (name) fs.unlink(path.join(SUBMISSION_DIR, path.basename(name)), () => {}); };

/**
 * Converts one submitted video to a browser-safe MP4 in the background (videoConvert.js),
 * then points the record's entry (in `videos` and the `submission` mirror) at the MP4.
 * A video deleted meanwhile is left alone and both files are removed.
 */
export function queueSubmissionConversion(recordId, file) {
  const setEntry = async (prefix, fields) => {
    const sets = Object.fromEntries(Object.entries(fields).map(([k, v]) => [`${prefix}.${k}`, v]));
    const filter = { _id: recordId, [`${prefix === 'videos.$' ? 'videos' : 'submission'}.file`]: file };
    return (await TopicActivity.updateOne(filter, { $set: sets })).matchedCount > 0;
  };
  const setBoth = async (fields) => {
    const [inList, latest] = await Promise.all([setEntry('videos.$', fields), setEntry('submission', fields)]);
    return inList || latest;
  };
  queueConversion({
    key: `submission:${recordId}:${file}`,
    src: path.join(SUBMISSION_DIR, path.basename(file)),
    save: async (dest) => setBoth(dest
      ? { file: path.basename(dest), mimeType: 'video/mp4', size: fs.statSync(dest).size, status: 'ready' }
      : { status: 'ready' }),
    onFailed: () => setBoth({ status: 'failed' }),
  });
}

/** The topic must be this kind of topic in this course, and the learner enrolled in it. */
async function checkTopic(userId, courseId, topicId, type) {
  const db = mongoose.connection.db;
  const topic = await db.collection('topics').findOne(
    { _id: oid(topicId), courseId: oid(courseId), deletedAt: null },
    { projection: { video_type: 1, chapterId: 1, maxVideos: 1 } },
  );
  if (!topic || TYPE_FOR_TOPIC[String(topic.video_type || '').toLowerCase()] !== type) return { error: [400, 'Invalid topic.'] };
  const enrolled = await db.collection('course_assignments').findOne({ userId, courseId: oid(courseId) }, { projection: { _id: 1 } });
  if (!enrolled) return { error: [403, 'You are not enrolled in this course.'] };
  return { topic };
}

/** Records the activity once (idempotent). Body: { courseId, topicId } */
const record = (type) => async (req, res, next) => {
  try {
    const { courseId, topicId } = req.body || {};
    if (!isId(courseId) || !isId(topicId)) return badRequest(res, 'courseId and topicId are required.');
    const userId = oid(req.user._id);
    const { topic, error } = await checkTopic(userId, courseId, topicId, type);
    if (error) return res.status(error[0]).json({ status: error[0], message: error[1] });

    const data = await TopicActivity.findOneAndUpdate(
      { userId, topicId: topic._id, type },
      { $setOnInsert: { userId, courseId: oid(courseId), chapterId: topic.chapterId || null, topicId: topic._id, type } },
      { upsert: true, returnDocument: 'after' },
    ).lean();
    res.status(200).json({ status: 200, message: 'Recorded.', data });
  } catch (error) { next(error); }
};

// POST /topic-activity/assignment-submit — multipart { courseId, topicId, video }
// Adds one video (≤ 2 GB) to the learner's assignment — one at a time, until it is approved,
// and never more than the assignment's "How many videos can upload?" in total (rejections
// don't reset it). Every upload puts it back to "waiting for review".
const submitAssignment = (req, res, next) => {
  submissionUpload(req, res, async (uploadErr) => {
    const uploaded = req.file?.filename;
    try {
      if (uploadErr) {
        if (uploadErr.code === 'LIMIT_FILE_SIZE') return badRequest(res, `The video must be ${MAX_SUBMISSION_LABEL} or smaller.`);
        return res.status(uploadErr.statusCode || 400).json({ status: uploadErr.statusCode || 400, message: uploadErr.message });
      }
      if (!req.file) return badRequest(res, 'Please choose a video to upload.');
      const { courseId, topicId } = req.body || {};
      if (!isId(courseId) || !isId(topicId)) { removeFile(uploaded); return badRequest(res, 'courseId and topicId are required.'); }

      const userId = oid(req.user._id);
      const { topic, error } = await checkTopic(userId, courseId, topicId, 'assignment_done');
      if (error) { removeFile(uploaded); return res.status(error[0]).json({ status: error[0], message: error[1] }); }

      const previous = await TopicActivity.findOne({ userId, topicId: topic._id, type: 'assignment_done' }).select('submission videos review').lean();
      if (previous?.review?.status === 'approved') { removeFile(uploaded); return badRequest(res, 'This assignment is already complete.'); }
      const earlier = allVideos(previous);
      const limit = videoLimit(topic);
      if (earlier.length >= limit) { removeFile(uploaded); return badRequest(res, limitMessage(limit)); }
      // Plays in every browser as is ('ready'), or is converted to MP4 first ('processing').
      let status;
      try {
        status = await initialVideoStatus(req.file.path);
      } catch (probeErr) {
        removeFile(uploaded);
        return badRequest(res, `${probeErr.message} Please upload a video in ${ALLOWED_VIDEO_FORMATS_LABEL} format.`);
      }
      const submission = {
        file: req.file.filename, originalName: req.file.originalname, mimeType: req.file.mimetype,
        size: req.file.size, uploadedAt: new Date(), comment: null, status,
      };
      const data = await addVideo({ userId, courseId, topic, previous, earlier, submission, limit });
      if (!data) { removeFile(uploaded); return badRequest(res, limitMessage(limit)); }
      if (status === 'processing') queueSubmissionConversion(data._id, submission.file);
      res.status(200).json({ status: 200, message: 'Video uploaded — waiting for review.', data: publicRecord(data) });
    } catch (error) { removeFile(uploaded); next(error); }
  });
};

/**
 * Save one more video — atomically, so two uploads at the same moment can never take the
 * learner past the limit. Returns the updated record, or null when the limit (or an
 * approval) got there first.
 */
async function addVideo({ userId, courseId, topic, previous, earlier, submission, limit }) {
  const key = { userId, topicId: topic._id, type: 'assignment_done' };
  const pending = { status: 'pending', note: '', reviewedBy: null, reviewerName: '', reviewedAt: null };
  if (Array.isArray(previous?.videos) && previous.videos.length) {
    // Only matches while the record still has fewer than `limit` videos (no videos[limit-1]).
    return TopicActivity.findOneAndUpdate(
      { ...key, 'review.status': { $ne: 'approved' }, [`videos.${limit - 1}`]: { $exists: false } },
      { $push: { videos: submission }, $set: { submission, review: pending } },
      { returnDocument: 'after' },
    ).lean();
  }
  // First video (or an old record that only has a single `submission`).
  try {
    return await TopicActivity.findOneAndUpdate(
      { ...key, 'videos.0': { $exists: false }, 'review.status': { $ne: 'approved' } },
      {
        $set: { videos: [...earlier, submission], submission, review: pending },
        $setOnInsert: { userId, courseId: oid(courseId), chapterId: topic.chapterId || null, topicId: topic._id, type: 'assignment_done' },
      },
      { upsert: true, returnDocument: 'after' },
    ).lean();
  } catch (err) {
    // Another upload created the record a moment ago: add this one after it (same limit).
    if (err?.code !== 11000) throw err;
    const now = await TopicActivity.findOne(key).select('videos').lean();
    if (!Array.isArray(now?.videos) || !now.videos.length) throw err;
    return addVideo({ userId, courseId, topic, previous: now, earlier: now.videos, submission, limit });
  }
}

// POST /topic-activity/assignment-video-delete { courseId, topicId, video } — the learner's own record.
// Deletes one uploaded video (and its file) while the assignment isn't approved. Its upload
// slot is freed. The review is kept (never cleared to null): a record with no video and no
// review would count as an old "Mark as Done" and complete the homework.
const deleteAssignmentVideo = async (req, res, next) => {
  try {
    const { courseId, topicId } = req.body || {};
    const n = Number(req.body?.video);
    if (!isId(courseId) || !isId(topicId) || !Number.isInteger(n) || n < 1) return badRequest(res, 'A valid video is required.');
    const userId = oid(req.user._id);
    const { topic, error } = await checkTopic(userId, courseId, topicId, 'assignment_done');
    if (error) return res.status(error[0]).json({ status: error[0], message: error[1] });

    const key = { userId, topicId: topic._id, type: 'assignment_done' };
    const rec = await TopicActivity.findOne(key).lean();
    const list = allVideos(rec);
    const target = list[n - 1];
    if (!target) return res.status(404).json({ status: 404, message: 'Video not found.' });
    if (rec.review?.status === 'approved') return badRequest(res, 'This assignment is approved — its videos can no longer be changed.');

    const rest = list.filter((_, i) => i !== n - 1);
    const review = rec.review || { status: 'pending', note: '', reviewedBy: null, reviewerName: '', reviewedAt: null };
    // Only if nothing changed since it was read (e.g. an upload or approval at the same moment).
    const data = await TopicActivity.findOneAndUpdate(
      { ...key, updatedAt: rec.updatedAt, 'review.status': { $ne: 'approved' } },
      { $set: { videos: rest, submission: rest[rest.length - 1] || null, review } },
      { returnDocument: 'after' },
    ).lean();
    if (!data) return res.status(409).json({ status: 409, message: 'This assignment changed just now — please reload and try again.' });
    removeFile(target.file);
    res.status(200).json({ status: 200, message: `Video ${n} deleted.`, data: publicRecord(data) });
  } catch (error) { next(error); }
};

/** What the client sees of a record (never the stored file name). */
const publicComment = (c) => ({ note: c.note || '', status: c.status || '', reviewerName: c.reviewerName || '', reviewedAt: c.reviewedAt || null });
/** All comments on a video, oldest first — older records only have the single `comment`. */
const videoComments = (v) => (Array.isArray(v.comments) && v.comments.length ? v.comments : (v.comment && (v.comment.note || v.comment.status) ? [v.comment] : []));
const publicVideo = (v, i) => {
  const comments = videoComments(v).map(publicComment);
  return {
    n: i + 1, originalName: v.originalName, size: v.size, uploadedAt: v.uploadedAt,
    status: v.status || 'ready', // 'processing' while being converted to MP4 (older videos have none)
    comments,
    comment: comments[comments.length - 1] || null, // the latest (for older screens)
  };
};
const publicRecord = (r) => ({
  _id: r._id, topicId: r.topicId, type: r.type, createdAt: r.createdAt,
  submission: r.submission ? { originalName: r.submission.originalName, size: r.submission.size, uploadedAt: r.submission.uploadedAt } : null,
  videos: allVideos(r).map(publicVideo),
  review: publicReview(r.review),
});
const publicReview = (rv) => (rv ? { status: rv.status, note: rv.note || '', reviewerName: rv.reviewerName || '', reviewedAt: rv.reviewedAt || null } : null);

// GET /topic-activity/mine?courseId= — the learner's own records for a course
const mine = async (req, res, next) => {
  try {
    const { courseId } = req.query;
    if (!isId(courseId)) return badRequest(res, 'courseId is required.');
    const rows = await TopicActivity.find({ userId: req.user._id, courseId })
      .select('topicId type createdAt submission videos review').lean();
    res.status(200).json({ status: 200, message: 'Successfully fetched.', data: rows.map(publicRecord) });
  } catch (error) { next(error); }
};

/** Who is asking: { role: 'superadmin' | 'owner' | 'learner', orgId } (fresh from the database). */
async function viewer(req) {
  if (!mongoose.isValidObjectId(req.user?._id)) return null;
  const u = await mongoose.connection.db.collection('users').findOne(
    { _id: oid(req.user._id) }, { projection: { user_type: 1, orgId: 1, name: 1, email: 1 } },
  );
  if (!u) return null;
  // The name shown with comments / reviews — never an email address:
  // a store owner is shown as their organization, a super admin by name.
  if (u.user_type === 'superadmin') return { role: 'superadmin', userId: String(u._id), name: u.name || 'Super Admin' };
  if (u.user_type === 'organization' && u.orgId) {
    const org = await mongoose.connection.db.collection('organizations').findOne({ _id: u.orgId }, { projection: { org_name: 1 } });
    return { role: 'owner', orgId: String(u.orgId), userId: String(u._id), name: org?.org_name || u.name || 'Store owner' };
  }
  return { role: 'learner', userId: String(u._id) };
}

// GET /topic-activity/submissions?courseId=&orgId=&userId= — homework videos.
// Super admin: every organization (optionally filtered). Store owner: own organization's learners only.
const submissions = async (req, res, next) => {
  try {
    const who = await viewer(req);
    if (!who || who.role === 'learner') return forbidden(res, 'Only a super admin or store owner can view submissions.');
    const db = mongoose.connection.db;
    const { courseId, orgId, userId } = req.query;

    const userFilter = { user_type: 'employee' };
    if (who.role === 'owner') userFilter.orgId = oid(who.orgId);
    else if (isId(orgId)) userFilter.orgId = oid(orgId);
    if (isId(userId)) userFilter._id = oid(userId);
    const learners = await db.collection('users').find(userFilter, { projection: { name: 1, email: 1, orgId: 1 } }).toArray();
    if (!learners.length) return res.status(200).json({ status: 200, message: 'Successfully fetched.', data: [] });

    const match = { type: 'assignment_done', submission: { $ne: null }, userId: { $in: learners.map(l => l._id) } };
    if (isId(courseId)) match.courseId = oid(courseId);
    const rows = await TopicActivity.find(match).sort({ 'submission.uploadedAt': -1 }).limit(500).lean();

    const ids = (key) => [...new Set(rows.map(r => String(r[key] || '')).filter(Boolean))].map(oid);
    const byId = async (coll, key, projection) => new Map((await db.collection(coll).find({ _id: { $in: ids(key) } }, { projection }).toArray()).map(d => [String(d._id), d]));
    const [courses, chapters, topics] = await Promise.all([
      byId('courses', 'courseId', { title: 1 }),
      byId('chapters', 'chapterId', { title: 1 }),
      byId('topics', 'topicId', { title: 1 }),
    ]);
    const learnerById = new Map(learners.map(l => [String(l._id), l]));
    const orgIds = [...new Set(learners.map(l => String(l.orgId || '')).filter(Boolean))].map(oid);
    const orgs = new Map((await db.collection('organizations').find({ _id: { $in: orgIds } }, { projection: { org_name: 1 } }).toArray()).map(o => [String(o._id), o.org_name]));

    const data = rows.map(r => {
      const l = learnerById.get(String(r.userId)) || {};
      return {
        _id: r._id,
        learner: { _id: r.userId, name: l.name || '—', email: l.email || '' },
        organization: orgs.get(String(l.orgId || '')) || '—',
        course: courses.get(String(r.courseId))?.title || '—',
        chapter: chapters.get(String(r.chapterId))?.title || '—',
        topic: topics.get(String(r.topicId))?.title || '—',
        originalName: r.submission.originalName, size: r.submission.size, uploadedAt: r.submission.uploadedAt,
        videoStatus: r.submission.status || 'ready', // the latest video's playback readiness
        review: publicReview(r.review), userId: r.userId, courseId: r.courseId, chapterId: r.chapterId, topicId: r.topicId,
        videoCount: allVideos(r).length,
      };
    });
    res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
  } catch (error) { next(error); }
};

// GET /topic-activity/submissions/:id/video?v=N — video N of the assignment (default: the latest).
// Streamed with Range support, so a 2 GB video starts playing at once and can be seeked. Mounted
// in app.js with mediaProtect: a <video> tag can't send the login header, so it may carry the
// short-lived media token (?mt=) instead.
export const submissionVideo = async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return badRequest(res, 'Invalid submission.');
    const rec = await TopicActivity.findOne({ _id: oid(req.params.id), type: 'assignment_done', submission: { $ne: null } }).lean();
    if (!rec) return res.status(404).json({ status: 404, message: 'Submission not found.' });

    const who = await viewer(req);
    if (!who) return forbidden(res);
    if (who.role === 'learner' && who.userId !== String(rec.userId)) return forbidden(res);
    if (who.role === 'owner') {
      const learner = await mongoose.connection.db.collection('users').findOne({ _id: rec.userId }, { projection: { orgId: 1 } });
      if (String(learner?.orgId || '') !== who.orgId) return forbidden(res);
    }

    const list = allVideos(rec);
    const n = req.query.v === undefined ? list.length : Number.parseInt(req.query.v, 10);
    const video = Number.isInteger(n) && n >= 1 ? list[n - 1] : null;
    if (!video) return res.status(404).json({ status: 404, message: 'Video not found.' });
    if (video.status === 'processing') {
      return res.status(409).json({ status: 409, message: 'This video is being prepared for playback. Please try again in a few minutes.' });
    }
    if (video.status === 'failed') {
      return res.status(422).json({ status: 422, message: 'This video could not be prepared for playback. Please upload it again.' });
    }
    const filePath = path.join(SUBMISSION_DIR, path.basename(video.file));
    if (!fs.existsSync(filePath)) return res.status(404).json({ status: 404, message: 'The video file is missing.' });
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    if (video.mimeType) res.type(video.mimeType);
    res.sendFile(filePath);
  } catch (error) { next(error); }
};

// Homework is completed only by uploading a video (assignment-submit) — there is no plain "mark as done".
/** A reviewer (super admin, or the store owner of this learner's org) and the learner. */
async function reviewerFor(req, learnerId) {
  const who = await viewer(req);
  if (!who || who.role === 'learner') return { error: [403, 'Only a super admin or store owner can review assignments.'] };
  if (!isId(learnerId)) return { error: [400, 'A valid learner is required.'] };
  const learner = await mongoose.connection.db.collection('users').findOne(
    { _id: oid(learnerId), user_type: 'employee' }, { projection: { name: 1, email: 1, orgId: 1 } },
  );
  if (!learner) return { error: [404, 'Learner not found.'] };
  if (who.role === 'owner' && String(learner.orgId || '') !== who.orgId) return { error: [403, 'This learner is not in your organization.'] };
  return { who, learner };
}

// GET /topic-activity/review-items?userId=&courseId=&chapterId=
// Every assignment in the chapter (or course) with this learner's submission and review.
const reviewItems = async (req, res, next) => {
  try {
    const { userId, courseId, chapterId } = req.query;
    const { error } = await reviewerFor(req, userId);
    if (error) return res.status(error[0]).json({ status: error[0], message: error[1] });
    if (!isId(courseId)) return badRequest(res, 'courseId is required.');
    const db = mongoose.connection.db;
    const topicFilter = { courseId: oid(courseId), deletedAt: null, video_type: { $regex: /^assignment$/i } };
    if (isId(chapterId)) topicFilter.chapterId = { $in: [oid(chapterId), String(chapterId)] };
    const topics = await db.collection('topics').find(topicFilter).project({ title: 1, chapterId: 1, order: 1, attachments: 1 }).sort({ order: 1, createdAt: 1 }).toArray();
    const records = await TopicActivity.find({ userId: oid(userId), type: 'assignment_done', topicId: { $in: topics.map(x => x._id) } }).lean();
    const byTopic = new Map(records.map(r => [String(r.topicId), r]));
    const enrolled = await db.collection('course_assignments').findOne({ userId: oid(userId), courseId: oid(courseId) }, { projection: { _id: 1 } });
    const data = topics.map(tp => {
      const r = byTopic.get(String(tp._id));
      return {
        topicId: tp._id, title: tp.title || 'Assignment', chapterId: tp.chapterId,
        attachment: Array.isArray(tp.attachments) && tp.attachments[0] ? { name: tp.attachments[0].name } : null,
        recordId: r?._id || null,
        submission: r?.submission ? { originalName: r.submission.originalName, size: r.submission.size, uploadedAt: r.submission.uploadedAt } : null,
        videos: allVideos(r).map(publicVideo),
        review: publicReview(r?.review),
        // done = counts as complete: approved by a reviewer (or an old pre-video "Mark as Done")
        done: isHomeworkDone(r),
      };
    });
    res.status(200).json({ status: 200, message: 'Successfully fetched.', data, enrolled: Boolean(enrolled) });
  } catch (error) { next(error); }
};

// GET /topic-activity/chapter-learners?courseId=&chapterId= — super admin only.
// Learners enrolled in the course (all organizations) who have uploaded at least one video
// for the chapter's assignments, newest upload first — with how many are approved / waiting
// for review / rejected / not uploaded yet.
const chapterLearners = async (req, res, next) => {
  try {
    const who = await viewer(req);
    if (who?.role !== 'superadmin') return res.status(403).json({ status: 403, message: 'Only a super admin can see this list.' });
    const { courseId, chapterId } = req.query;
    if (!isId(courseId) || !isId(chapterId)) return badRequest(res, 'courseId and chapterId are required.');
    const db = mongoose.connection.db;

    const topics = await db.collection('topics').find({
      courseId: oid(courseId), chapterId: { $in: [oid(chapterId), String(chapterId)] }, deletedAt: null, video_type: { $regex: /^assignment$/i },
    }).project({ _id: 1 }).toArray();
    const topicIds = topics.map(x => x._id);

    const enrolledIds = await db.collection('course_assignments').distinct('userId', { courseId: oid(courseId) });
    const learners = await db.collection('users').find({ _id: { $in: enrolledIds }, user_type: 'employee', deletedAt: null })
      .project({ name: 1, email: 1, orgId: 1 }).toArray();
    const orgIds = [...new Set(learners.map(u => String(u.orgId || '')).filter(isId))].map(oid);
    const orgs = await db.collection('organizations').find({ _id: { $in: orgIds } }).project({ org_name: 1 }).toArray();
    const orgName = new Map(orgs.map(o => [String(o._id), o.org_name || '']));

    const records = topicIds.length
      ? await TopicActivity.find({ userId: { $in: learners.map(u => u._id) }, type: 'assignment_done', topicId: { $in: topicIds } })
        .select('userId submission videos review').lean()
      : [];
    const byUser = new Map();
    records.forEach(r => { const k = String(r.userId); byUser.set(k, [...(byUser.get(k) || []), r]); });

    const data = learners.map(u => {
      const recs = byUser.get(String(u._id)) || [];
      const approved = recs.filter(isHomeworkDone).length;
      const rejected = recs.filter(r => r.review?.status === 'reupload').length;
      const waiting = recs.filter(r => !isHomeworkDone(r) && r.review?.status !== 'reupload' && allVideos(r).length > 0).length;
      const lastUploadAt = recs.flatMap(allVideos).reduce((m, v) => (v.uploadedAt && (!m || v.uploadedAt > m) ? v.uploadedAt : m), null);
      return {
        learnerId: u._id, name: u.name || '', email: u.email || '',
        orgId: u.orgId || null, orgName: orgName.get(String(u.orgId || '')) || '',
        assignments: topicIds.length, approved, waiting, rejected,
        notSubmitted: Math.max(0, topicIds.length - approved - waiting - rejected),
        videos: recs.reduce((n, r) => n + allVideos(r).length, 0), lastUploadAt,
      };
    })
      .filter(r => r.videos > 0) // learners who haven't uploaded anything aren't listed
      .sort((a, b) => new Date(b.lastUploadAt) - new Date(a.lastUploadAt) || (a.name || a.email).localeCompare(b.name || b.email));
    res.status(200).json({ status: 200, message: 'Successfully fetched.', data, assignments: topicIds.length });
  } catch (error) { next(error); }
};

// POST /topic-activity/review { userId, topicId, status: 'approved' | 'reupload', note }
// The final decision on the whole assignment, given after watching (and commenting on) the videos:
//   approved ("Approved") → complete; from then on nothing can be changed (no comments, no review).
//   reupload ("Rejected") → the learner must upload again; they are emailed and see it in their activity.
// approved → the homework is complete (works even if no video was uploaded).
// reupload → the learner must upload a new video; they are emailed and it shows in their activity.
const reviewAssignment = async (req, res, next) => {
  try {
    const { userId, topicId, status } = req.body || {};
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 1000) : '';
    if (!['approved', 'reupload'].includes(status)) return badRequest(res, 'Choose "Mark as complete" or "Ask to re-upload".');
    if (!isId(topicId)) return badRequest(res, 'A valid assignment is required.');
    const { who, learner, error } = await reviewerFor(req, userId);
    if (error) return res.status(error[0]).json({ status: error[0], message: error[1] });

    const db = mongoose.connection.db;
    const topic = await db.collection('topics').findOne({ _id: oid(topicId), deletedAt: null }, { projection: { video_type: 1, chapterId: 1, courseId: 1, title: 1 } });
    if (!topic || String(topic.video_type || '').toLowerCase() !== 'assignment') return badRequest(res, 'Invalid assignment.');
    const enrolled = await db.collection('course_assignments').findOne({ userId: learner._id, courseId: topic.courseId }, { projection: { _id: 1 } });
    if (!enrolled) return badRequest(res, 'This learner is not enrolled in the course.');

    const existing = await TopicActivity.findOne({ userId: learner._id, topicId: topic._id, type: 'assignment_done' }).lean();
    if (existing?.review?.status === 'approved') return badRequest(res, 'This assignment is already approved — it can no longer be changed.');
    if (status === 'reupload' && !existing?.submission) return badRequest(res, 'The learner has not uploaded a video yet — there is nothing to reject.');

    const review = { status, note, reviewedBy: oid(who.userId), reviewerName: who.name, reviewedAt: new Date() };
    const set = { review };
    const data = await TopicActivity.findOneAndUpdate(
      { userId: learner._id, topicId: topic._id, type: 'assignment_done' },
      {
        $set: set,
        // (no video yet → a new record starts with none; with videos, $set above already sets it)
        $setOnInsert: { userId: learner._id, courseId: topic.courseId, chapterId: topic.chapterId || null, topicId: topic._id, type: 'assignment_done', ...(set.submission ? {} : { submission: null }) },
      },
      { upsert: true, returnDocument: 'after' },
    ).lean();
    res.status(200).json({ status: 200, message: status === 'approved' ? 'Assignment approved.' : 'Assignment rejected — the learner has been asked to upload again.', data: publicRecord(data) });

    if (status === 'reupload' && learner.email) {
      const course = await db.collection('courses').findOne({ _id: topic.courseId }, { projection: { title: 1 } }).catch(() => null);
      sendEmail(learner.email, `Please re-upload your assignment video: ${topic.title || 'Assignment'}`, reuploadEmail({
        name: learner.name || 'Learner', topic: topic.title || 'Assignment', course: course?.title || 'your course', note, reviewer: who.name,
      })).catch(() => {});
    }
  } catch (error) { next(error); }
};

// POST /topic-activity/video-comment { userId, topicId, video, note }
// The reviewer's comment on one uploaded video (1-based `video`). Not allowed once approved.
const commentVideo = async (req, res, next) => {
  try {
    const { userId, topicId } = req.body || {};
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 1000) : '';
    const n = Number.parseInt(req.body?.video, 10);
    if (!isId(topicId)) return badRequest(res, 'A valid assignment is required.');
    if (!note) return badRequest(res, 'Write a comment first.');
    const { who, learner, error } = await reviewerFor(req, userId);
    if (error) return res.status(error[0]).json({ status: error[0], message: error[1] });

    const existing = await TopicActivity.findOne({ userId: learner._id, topicId: oid(topicId), type: 'assignment_done' }).lean();
    const list = allVideos(existing);
    if (!Number.isInteger(n) || n < 1 || n > list.length) return badRequest(res, 'Video not found.');
    if (existing.review?.status === 'approved') return badRequest(res, 'This assignment is already approved — it can no longer be commented on.');

    const comment = { note, status: '', reviewedBy: oid(who.userId), reviewerName: who.name, reviewedAt: new Date() };
    // Each comment is added to the video's list — earlier comments are kept.
    const videos = list.map((v, i) => (i === n - 1 ? { ...v, comments: [...videoComments(v), comment], comment } : v));
    const data = await TopicActivity.findOneAndUpdate(
      { _id: existing._id },
      { $set: { videos, submission: videos[videos.length - 1] } },
      { returnDocument: 'after' },
    ).lean();
    res.status(200).json({ status: 200, message: `Comment added to Video ${n}.`, data: publicRecord(data) });
  } catch (error) { next(error); }
};

const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reuploadEmail = ({ name, topic, course, note, reviewer }) => `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#0b7b7b;padding:24px 32px;color:#fff;font-size:20px;font-weight:800;">sikhø <span style="color:#a8e6e6;">aur</span> badhø</td></tr>
      <tr><td style="padding:28px 32px;color:#1a2b2b;font-size:15px;line-height:1.6;">
        <p style="margin:0 0 12px;">Hi ${esc(name)},</p>
        <p style="margin:0 0 12px;">Your video for the assignment <strong>${esc(topic)}</strong> in <strong>${esc(course)}</strong> needs to be uploaded again.</p>
        ${note ? `<p style="margin:0 0 12px;padding:12px 14px;background:#fff7ed;border-left:3px solid #f59e0b;border-radius:6px;"><strong>Reviewer's note:</strong><br>${esc(note)}</p>` : ''}
        <p style="margin:0 0 12px;">Open the course, go to the assignment and upload a new video (max ${MAX_SUBMISSION_LABEL}).</p>
        <p style="margin:0;color:#6b7d7d;font-size:13px;">Reviewed by ${esc(reviewer || 'your instructor')}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

Router.post('/assignment-submit', submitAssignment);
Router.post('/assignment-video-delete', deleteAssignmentVideo);
Router.post('/zoom-join', record('zoom_joined'));
Router.get('/mine', mine);
Router.get('/submissions', submissions);
// GET /submissions/:id/video is mounted in app.js (mediaProtect), not here.
Router.get('/review-items', reviewItems);
Router.get('/chapter-learners', chapterLearners);
Router.post('/review', reviewAssignment);
Router.post('/video-comment', commentVideo);

export default Router;
