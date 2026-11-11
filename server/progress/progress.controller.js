import express from 'express';
import * as Service from './progress.service.js';

const Router = express.Router();

const update = async (req, res, next) => {
  try {
    const { topicId, courseId, watchedSeconds, durationSeconds, lastPosition } = req.body;
    if (!topicId || !courseId) {
      return res.status(400).json({ status: 400, message: 'topicId and courseId are required.' });
    }
    const data = await Service.updateProgress({
      userId: req.user._id,
      topicId, courseId,
      watchedSeconds:  Number(watchedSeconds)  || 0,
      durationSeconds: Number(durationSeconds) || 0,
      lastPosition:    Number(lastPosition)    ?? Number(watchedSeconds) ?? 0,
    });
    res.status(200).json({ status: 200, message: 'Progress saved.', data });
  } catch (error) {
    next(error);
  }
};

const courseProgress = async (req, res, next) => {
  try {
    const { courseId } = req.query;
    if (!courseId) return res.status(400).json({ status: 400, message: 'courseId is required.' });
    const data = await Service.getCourseProgress({ userId: req.user._id, courseId });
    res.status(200).json({ status: 200, message: 'Success.', data });
  } catch (error) {
    next(error);
  }
};

// Admin-scoped: lets a store owner look up any learner's progress for a course.
const courseProgressAdmin = async (req, res, next) => {
  try {
    const { courseId, userId } = req.query;
    if (!courseId || !userId) {
      return res.status(400).json({ status: 400, message: 'courseId and userId are required.' });
    }
    const data = await Service.getCourseProgress({ userId, courseId });
    res.status(200).json({ status: 200, message: 'Success.', data });
  } catch (error) {
    next(error);
  }
};

Router.post('/update',       update);
Router.get('/course',        courseProgress);
Router.get('/course-admin',  courseProgressAdmin);

export default Router;
