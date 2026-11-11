import mongoose from 'mongoose';
import Review from './review.model.js';

export const submitReview = async ({ userId, courseId, chapterId, rating, text }) => {
  return await Review.findOneAndUpdate(
    { userId, chapterId },
    { userId, courseId, chapterId, rating, text },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).lean();
};

export const listReviews = async ({ courseId, chapterId }) => {
  return await Review.find({ courseId, chapterId })
    .populate('userId', 'name')
    .sort({ createdAt: -1 })
    .lean();
};

export const getUserReview = async ({ userId, chapterId }) => {
  return await Review.findOne({ userId, chapterId }).lean();
};

export const getCourseStats = async ({ courseId }) => {
  const result = await Review.aggregate([
    { $match: { courseId: new mongoose.Types.ObjectId(courseId) } },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, total: { $sum: 1 } } },
  ]);
  if (!result.length) return { avgRating: 0, total: 0 };
  return { avgRating: Math.round(result[0].avgRating * 10) / 10, total: result[0].total };
};
