import express from 'express';
import mongoose from 'mongoose';
import { getMyProgressReport } from './my_progress_report.service.js';
import { getMyTestResultsReport } from './my_test_results_report.service.js';
import { getMyAchievementsReport } from './my_achievements_report.service.js';
import { getMyWeakAreasReport } from './my_weak_areas_report.service.js';

// Learner reports: always the signed-in learner's own data (from the token, never the request).
const Router = express.Router();

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (v) => {
  if (!YMD.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const param = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const badRequest = (res, message) => res.status(400).json({ status: 400, message });

// GET /my-report/progress?courseId= — my progress
const progressReport = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!mongoose.isValidObjectId(userId)) return res.status(401).json({ status: 401, message: 'Please sign in again.' });
    const courseId = param(req.query.courseId);
    if (courseId && !mongoose.isValidObjectId(courseId)) return badRequest(res, 'Invalid course.');
    const data = await getMyProgressReport({ userId: String(userId), courseId });
    res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
  } catch (error) { next(error); }
};

// GET /my-report/test-results?from=&to=&courseId= — my MCQ / speech scores and skip analysis
const testResultsReport = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!mongoose.isValidObjectId(userId)) return res.status(401).json({ status: 401, message: 'Please sign in again.' });
    const from = param(req.query.from), to = param(req.query.to), courseId = param(req.query.courseId);
    if ((from && !isRealDate(from)) || (to && !isRealDate(to))) return badRequest(res, 'Dates must be real dates in YYYY-MM-DD format.');
    if (from && to && from > to) return badRequest(res, 'The start date must be on or before the end date.');
    if (courseId && !mongoose.isValidObjectId(courseId)) return badRequest(res, 'Invalid course.');
    const data = await getMyTestResultsReport({ userId: String(userId), from, to, courseId });
    res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
  } catch (error) { next(error); }
};

// GET /my-report/achievements?courseId= — certificates, grade, leaderboard, strong / weak areas, attempts
const achievementsReport = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!mongoose.isValidObjectId(userId)) return res.status(401).json({ status: 401, message: 'Please sign in again.' });
    const courseId = param(req.query.courseId);
    if (courseId && !mongoose.isValidObjectId(courseId)) return badRequest(res, 'Invalid course.');
    const data = await getMyAchievementsReport({ userId: String(userId), courseId });
    res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
  } catch (error) { next(error); }
};

// GET /my-report/weak-areas?courseId= — low chapters, skipped questions, revision suggestions
const weakAreasReport = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!mongoose.isValidObjectId(userId)) return res.status(401).json({ status: 401, message: 'Please sign in again.' });
    const courseId = param(req.query.courseId);
    if (courseId && !mongoose.isValidObjectId(courseId)) return badRequest(res, 'Invalid course.');
    const data = await getMyWeakAreasReport({ userId: String(userId), courseId });
    res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
  } catch (error) { next(error); }
};

Router.get('/progress', progressReport);
Router.get('/weak-areas', weakAreasReport);
Router.get('/achievements', achievementsReport);
Router.get('/test-results', testResultsReport);

export default Router;
