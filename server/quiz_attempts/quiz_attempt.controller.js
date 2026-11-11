import express from 'express';
import mongoose from 'mongoose';
import * as Service from './quiz_attempt.service.js';

const Router = express.Router();

/** Seconds the learner spent (sent by the player): whole seconds up to a day, else not recorded. */
const cleanSeconds = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 86400 ? n : null;
};

const submit = async (req, res, next) => {
  try {
    const { topicId, courseId, chapterId, answers, timeTakenSec } = req.body;
    if (!topicId || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ status: 400, message: 'topicId and answers are required.' });
    }
    const attempt = await Service.submitAttempt({
      userId: req.user._id,
      topicId,
      courseId:   courseId  || null,
      chapterId:  chapterId || null,
      answers,
      timeTakenSec: cleanSeconds(timeTakenSec),
    });
    // The quiz is over — free this course's lesson videos right away instead of
    // waiting for the lock to lapse.
    if (courseId && mongoose.isValidObjectId(courseId)) {
      await Service.releaseQuizLock({ userId: req.user._id, courseId });
    }
    res.status(200).json({ status: 200, message: 'Quiz evaluated.', data: attempt });
  } catch (error) {
    if (error.status === 403) return res.status(403).json({ status: 403, message: error.message });
    next(error);
  }
};

const history = async (req, res, next) => {
  try {
    const { topicId } = req.query;
    if (!topicId) return res.status(400).json({ status: 400, message: 'topicId is required.' });
    const data = await Service.getAttemptHistory({ userId: req.user._id, topicId });
    res.status(200).json({ status: 200, message: 'Success.', data });
  } catch (error) {
    next(error);
  }
};

const byCourse = async (req, res, next) => {
  try {
    const { courseId, chapterId } = req.query;
    if (!courseId) return res.status(400).json({ status: 400, message: 'courseId is required.' });
    const data = await Service.getAttemptsByCourse({
      userId:    req.user._id,
      courseId,
      chapterId: chapterId || null,
    });
    res.status(200).json({ status: 200, message: 'Success.', data });
  } catch (error) {
    next(error);
  }
};

const byCourseAdmin = async (req, res, next) => {
  try {
    const { courseId } = req.query;
    if (!courseId) return res.status(400).json({ status: 400, message: 'courseId is required.' });
    const data = await Service.getAttemptsByCourseAdmin({ courseId });
    res.status(200).json({ status: 200, message: 'Success.', data });
  } catch (error) {
    next(error);
  }
};

// ── Quiz / video activity locks ──────────────────────────────────────────────
// A quiz in progress locks the course's lesson videos for this learner, and a
// playing lesson video locks the course's quizzes. ownerId identifies the
// holding browser tab so it can ignore its own lock.
const OWNER_ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const cleanOwnerId = (v) => (typeof v === 'string' && OWNER_ID_RE.test(v) ? v : null);

const makeLockHeartbeat = (acquire) => async (req, res, next) => {
  try {
    const { courseId, topicId, ownerId } = req.body;
    if (!mongoose.isValidObjectId(courseId) || !mongoose.isValidObjectId(topicId)) {
      return res.status(400).json({ status: 400, message: 'Valid courseId and topicId are required.' });
    }
    const data = await acquire({ userId: req.user._id, courseId, topicId, ownerId: cleanOwnerId(ownerId) });
    res.status(200).json({ status: 200, message: 'Locked.', data });
  } catch (error) {
    next(error);
  }
};

const makeUnlock = (release) => async (req, res, next) => {
  try {
    const { courseId, ownerId } = req.body;
    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ status: 400, message: 'Valid courseId is required.' });
    }
    await release({ userId: req.user._id, courseId, ownerId: cleanOwnerId(ownerId) });
    res.status(200).json({ status: 200, message: 'Unlocked.' });
  } catch (error) {
    next(error);
  }
};

const toLockInfo = (lock) => ({
  active:  !!lock,
  topicId: lock?.topicId || null,
  ownerId: lock?.ownerId || null,
});

const lockStatus = async (req, res, next) => {
  try {
    const { courseId } = req.query;
    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ status: 400, message: 'Valid courseId is required.' });
    }
    const [quizLock, videoLock] = await Promise.all([
      Service.getQuizLock({ userId: req.user._id, courseId }),
      Service.getVideoLock({ userId: req.user._id, courseId }),
    ]);
    const quiz = toLockInfo(quizLock);
    res.status(200).json({
      status: 200,
      message: 'Success.',
      data: { ...quiz, quiz, video: toLockInfo(videoLock) },
    });
  } catch (error) {
    next(error);
  }
};

Router.post('/submit',       submit);
Router.post('/lock',         makeLockHeartbeat(Service.heartbeatQuizLock));
Router.post('/unlock',       makeUnlock(Service.releaseQuizLock));
Router.post('/video-lock',   makeLockHeartbeat(Service.acquireVideoLock));
Router.post('/video-unlock', makeUnlock(Service.releaseVideoLock));
Router.get('/lock',          lockStatus);
Router.get('/history',       history);
Router.get('/course',        byCourse);
Router.get('/course-all',    byCourseAdmin);

export default Router;
