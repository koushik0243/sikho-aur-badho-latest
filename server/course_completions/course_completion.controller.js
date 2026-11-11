import express from 'express';
import mongoose from 'mongoose';
import * as Service from './course_completion.service.js';
import User from '../users/user.model.js';

// Who may see another learner's certificate status: a super admin, the
// learner, or an owner/admin/manager of the learner's own organization.
const ORG_VIEWER_ROLES = ['owner', 'admin', 'manager'];
async function canViewLearner(requester, learnerId) {
  if (!requester?._id) return false;
  if (String(requester._id) === String(learnerId)) return true;
  const [me, learner] = await Promise.all([
    User.findById(requester._id).select('user_type orgId orgRole deletedAt').lean(),
    User.findById(learnerId).select('orgId deletedAt').lean(),
  ]);
  if (!me || me.deletedAt || !learner || learner.deletedAt) return false;
  if (me.user_type === 'superadmin') return true;
  return !!me.orgId && !!learner.orgId && String(me.orgId) === String(learner.orgId)
    && ORG_VIEWER_ROLES.includes(me.orgRole);
}

const Router = express.Router();

// GET /course-completion?courseId= → this learner's certificate record, or null
const getOne = async (req, res, next) => {
  try {
    const { courseId } = req.query;
    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ status: 400, message: 'Valid courseId is required.' });
    }
    const data = await Service.getCompletion({ userId: req.user._id, courseId });
    res.status(200).json({ status: 200, message: 'Success.', data: data || null });
  } catch (error) {
    next(error);
  }
};

// GET /course-completion/list → every course this learner holds a certificate for
const list = async (req, res, next) => {
  try {
    const data = await Service.listCompletions({ userId: req.user._id });
    res.status(200).json({ status: 200, message: 'Success.', data });
  } catch (error) {
    next(error);
  }
};

// POST /course-completion/complete { courseId } → records the certificate once
// the server confirms the course is done; idempotent.
const complete = async (req, res, next) => {
  try {
    const { courseId } = req.body;
    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ status: 400, message: 'Valid courseId is required.' });
    }
    const { record, reason } = await Service.markCourseComplete({ userId: req.user._id, courseId });
    if (!record) return res.status(409).json({ status: 409, message: reason, data: null });
    res.status(200).json({ status: 200, message: 'Course completed.', data: record });
  } catch (error) {
    next(error);
  }
};

// GET /course-completion/learner-status?userId=&courseId= → that learner's
// certificate status for the course (store owner / super admin certificate page).
const learnerStatus = async (req, res, next) => {
  try {
    const { userId, courseId } = req.query;
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ status: 400, message: 'Valid userId and courseId are required.' });
    }
    if (!(await canViewLearner(req.user, userId))) {
      return res.status(403).json({ status: 403, message: 'Not allowed to view this learner.' });
    }
    const data = await Service.getLearnerCourseStatus({ userId, courseId });
    res.status(200).json({ status: 200, message: 'Success.', data });
  } catch (error) {
    next(error);
  }
};

Router.get('/learner-status', learnerStatus);
Router.get('/',          getOne);
Router.get('/list',      list);
Router.post('/complete', complete);

export default Router;
