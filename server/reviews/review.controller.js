import express from 'express';
import * as ReviewHelper from './review.service.js';

const Router = express.Router();

const submitReview = async (req, res, next) => {
  try {
    const { courseId, chapterId, rating, text } = req.body;
    if (!courseId || !chapterId || !rating || !text?.trim()) {
      return res.status(400).json({ status: 400, message: 'courseId, chapterId, rating and text are required.' });
    }
    const data = await ReviewHelper.submitReview({
      userId: req.user._id, courseId, chapterId,
      rating: Number(rating), text,
    });
    res.status(200).json({ status: 200, message: 'Review saved.', data });
  } catch (error) {
    next(error);
  }
};

const listReviews = async (req, res, next) => {
  try {
    const { courseId, chapterId } = req.query;
    if (!courseId || !chapterId) {
      return res.status(400).json({ status: 400, message: 'courseId and chapterId are required.' });
    }
    const data = await ReviewHelper.listReviews({ courseId, chapterId });
    res.status(200).json({ status: 200, message: 'Success.', data });
  } catch (error) {
    next(error);
  }
};

const getUserReview = async (req, res, next) => {
  try {
    const { chapterId } = req.query;
    if (!chapterId) {
      return res.status(400).json({ status: 400, message: 'chapterId is required.' });
    }
    const data = await ReviewHelper.getUserReview({ userId: req.user._id, chapterId });
    res.status(200).json({ status: 200, message: 'Success.', data });
  } catch (error) {
    next(error);
  }
};

const getCourseStats = async (req, res, next) => {
  try {
    const { courseId } = req.query;
    if (!courseId) {
      return res.status(400).json({ status: 400, message: 'courseId is required.' });
    }
    const data = await ReviewHelper.getCourseStats({ courseId });
    res.status(200).json({ status: 200, message: 'Success.', data });
  } catch (error) {
    next(error);
  }
};

Router.post('/submit',     submitReview);
Router.get('/list',        listReviews);
Router.get('/mine',        getUserReview);
Router.get('/stats',       getCourseStats);

export default Router;
