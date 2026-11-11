import express from 'express';
import mongoose from 'mongoose';
import { getOrgEmployeesReport } from './org_employees_report.service.js';
import { getOrgProgressReport } from './org_progress_report.service.js';
import { getOrgTestResultsReport } from './org_test_results_report.service.js';
import { getOrgPurchasesReport } from './org_purchases_report.service.js';
import { getOrgSummaryReport } from './org_summary_report.service.js';

// Store owner reports. The organization always comes from the signed-in
// owner's own account — never from the request — so an owner only sees their
// own organization.
const Router = express.Router();

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const param = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const isRealDate = (s) => {
  if (!YMD.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; // rejects 2026-13-01, 2026-02-30
};
const badRequest = (res, message) => res.status(400).json({ status: 400, message });

/** Use after `protect`: only an organization owner may continue; sets req.orgId. */
const requireOrgOwner = async (req, res, next) => {
  try {
    const id = req.user?._id;
    if (!mongoose.isValidObjectId(id)) return res.status(403).json({ status: 403, message: 'Only a store owner can view this report.' });
    const user = await mongoose.connection.db.collection('users').findOne(
      { _id: new mongoose.Types.ObjectId(id), deletedAt: null },
      { projection: { user_type: 1, orgId: 1, status: 1 } },
    );
    if (!user || user.user_type !== 'organization' || !user.orgId) {
      return res.status(403).json({ status: 403, message: 'Only a store owner can view this report.' });
    }
    req.orgId = String(user.orgId);
    next();
  } catch (error) { next(error); }
};

// GET /org-report/employees?from=&to= — my organization's employees
const employeesReport = async (req, res, next) => {
  try {
    const from = param(req.query.from), to = param(req.query.to);
    if ((from && !isRealDate(from)) || (to && !isRealDate(to))) return badRequest(res, 'Dates must be real dates in YYYY-MM-DD format.');
    if (from && to && from > to) return badRequest(res, 'The start date must be on or before the end date.');
    const data = await getOrgEmployeesReport({ orgId: req.orgId, from, to });
    res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
  } catch (error) { next(error); }
};

// GET /org-report/progress?learnerId=&courseId= — chapter / phase progress per employee
const progressReport = async (req, res, next) => {
  try {
    const learnerId = param(req.query.learnerId), courseId = param(req.query.courseId);
    if (learnerId && !mongoose.isValidObjectId(learnerId)) return badRequest(res, 'Invalid employee.');
    if (courseId && !mongoose.isValidObjectId(courseId)) return badRequest(res, 'Invalid course.');
    const data = await getOrgProgressReport({ orgId: req.orgId, learnerId, courseId });
    res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
  } catch (error) { next(error); }
};

// GET /org-report/test-results?from=&to=&learnerId=&courseId= — quiz / aptitude results
const testResultsReport = async (req, res, next) => {
  try {
    const from = param(req.query.from), to = param(req.query.to);
    const learnerId = param(req.query.learnerId), courseId = param(req.query.courseId);
    if ((from && !isRealDate(from)) || (to && !isRealDate(to))) return badRequest(res, 'Dates must be real dates in YYYY-MM-DD format.');
    if (from && to && from > to) return badRequest(res, 'The start date must be on or before the end date.');
    if (learnerId && !mongoose.isValidObjectId(learnerId)) return badRequest(res, 'Invalid employee.');
    if (courseId && !mongoose.isValidObjectId(courseId)) return badRequest(res, 'Invalid course.');
    const data = await getOrgTestResultsReport({ orgId: req.orgId, from, to, learnerId, courseId });
    res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
  } catch (error) { next(error); }
};

// GET /org-report/purchases?from=&to= — credits bought / used / remaining, invoices
const purchasesReport = async (req, res, next) => {
  try {
    const from = param(req.query.from), to = param(req.query.to);
    if ((from && !isRealDate(from)) || (to && !isRealDate(to))) return badRequest(res, 'Dates must be real dates in YYYY-MM-DD format.');
    if (from && to && from > to) return badRequest(res, 'The start date must be on or before the end date.');
    const data = await getOrgPurchasesReport({ orgId: req.orgId, from, to });
    res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
  } catch (error) { next(error); }
};

// GET /org-report/summary?courseId= — completion %, best / weak performers, Zoom + homework
const summaryReport = async (req, res, next) => {
  try {
    const courseId = param(req.query.courseId);
    if (courseId && !mongoose.isValidObjectId(courseId)) return badRequest(res, 'Invalid course.');
    const data = await getOrgSummaryReport({ orgId: req.orgId, courseId });
    res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
  } catch (error) { next(error); }
};

Router.use(requireOrgOwner);
Router.get('/employees', employeesReport);
Router.get('/progress', progressReport);
Router.get('/test-results', testResultsReport);
Router.get('/purchases', purchasesReport);
Router.get('/summary', summaryReport);

export default Router;
