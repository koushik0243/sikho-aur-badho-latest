import mongoose from 'mongoose';
import User from '../users/user.model.js';
import OrganizationCourse from '../organization_course/organization_course.model.js';
import OrgCreditAssignment from '../organization_credit_assignment/organization_credit_assignment.model.js';
import CourseAssignment from '../course_assignments/course_assignment.model.js';
import Progress from '../progress/progress.model.js';
import QuizAttempt from '../quiz_attempts/quiz_attempt.model.js';

const { ObjectId } = mongoose.Types;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const LOW_CREDIT_RATIO = 0.2; // matches the "Low" warning threshold already used elsewhere

// Single aggregated read for the whole StoreOwner dashboard — one round trip instead of
// the page computing/faking each section separately. Every number here is derived from
// this org's own real records (learners, assigned courses, credits, progress, quiz
// attempts); nothing is a placeholder.
export const getDashboardSummary = async (orgId) => {
  if (!orgId || !ObjectId.isValid(orgId)) {
    const err = new Error('A valid orgId is required.');
    err.statusCode = 400;
    throw err;
  }
  const orgObjId = new ObjectId(orgId);
  const now = new Date();
  const monthAgo = new Date(now.getTime() - THIRTY_DAYS_MS);

  const [learners, orgCourses, creditAssignments, courseAssignments] = await Promise.all([
    User.find({ orgId: orgObjId, user_type: 'employee', orgRole: 'employee', deletedAt: null })
      .select('name email createdAt').lean(),
    OrganizationCourse.find({ orgId: orgObjId, deletedAt: null })
      .populate('courseId', 'title').lean(),
    OrgCreditAssignment.find({ orgId: orgObjId, deletedAt: null })
      .populate('creditId', 'limit_to price').lean(),
    CourseAssignment.find({ organizationId: orgObjId }).lean(),
  ]);

  const learnerIds = learners.map(l => l._id);
  const learnerById = new Map(learners.map(l => [String(l._id), l]));
  const courseIds = orgCourses
    .map(oc => oc.courseId?._id ?? oc.courseId)
    .filter(Boolean);

  // Credits: same formula already established for the Credits/Subscription/AddLearner
  // pages — total limit_to across every purchased credit plan, minus how many distinct
  // learners have actually been given a course (one "use" per learner, not per course).
  const totalCredits = creditAssignments.reduce((sum, ca) => sum + (ca.creditId?.limit_to ?? 0), 0);
  const assignedLearnerCount = new Set(courseAssignments.map(ca => String(ca.userId))).size;
  const creditsLeft = Math.max(0, totalCredits - assignedLearnerCount);

  const [progressDocs, quizAttempts] = await (learnerIds.length && courseIds.length
    ? Promise.all([
        Progress.find({ userId: { $in: learnerIds }, courseId: { $in: courseIds } }).lean(),
        QuizAttempt.find({ userId: { $in: learnerIds }, courseId: { $in: courseIds } })
          .sort({ createdAt: -1 }).lean(),
      ])
    : Promise.resolve([[], []]));

  // Per-course completion % — average of this org's learners' Progress.percentage
  // for that course (Progress already tracks per-topic watch%, rolled up per course).
  const courseCompletion = orgCourses.map(oc => {
    const cid = String(oc.courseId?._id ?? oc.courseId ?? '');
    const docs = progressDocs.filter(p => String(p.courseId) === cid);
    const pct = docs.length
      ? Math.round(docs.reduce((sum, d) => sum + (d.percentage || 0), 0) / docs.length)
      : 0;
    return { label: oc.courseId?.title || 'Untitled Course', pct };
  });

  const completionRate = courseCompletion.length
    ? Math.round(courseCompletion.reduce((sum, c) => sum + c.pct, 0) / courseCompletion.length)
    : 0;

  // Per-learner rollup: average quiz score + distinct courses passed, for ranking.
  const performerRows = learners.map(l => {
    const lid = String(l._id);
    const attempts = quizAttempts.filter(a => String(a.userId) === lid);
    const coursesAssignedToLearner = new Set(
      courseAssignments.filter(ca => String(ca.userId) === lid).map(ca => String(ca.courseId))
    ).size;
    const coursesPassed = new Set(
      attempts.filter(a => a.passed).map(a => String(a.courseId))
    ).size;
    const avgScore = attempts.length
      ? Math.round(attempts.reduce((sum, a) => sum + (a.totalScore || 0), 0) / attempts.length)
      : null;
    return {
      name: l.name,
      avgScore,
      coursesPassed,
      coursesAssigned: coursesAssignedToLearner,
      attemptCount: attempts.length,
    };
  });

  // Only rank learners who've actually attempted something — an untouched learner is
  // neither a "top" nor "bottom" performer, just not-yet-started.
  const ranked = performerRows.filter(p => p.attemptCount > 0).sort((a, b) => b.avgScore - a.avgScore);
  const topPerformers = ranked.slice(0, 4);
  // Bottom performers must never overlap with top — with <=4 ranked learners total,
  // there's no separate "bottom" group yet (everyone's already shown as top), so it
  // stays empty rather than showing the same people twice under contradictory labels.
  const bottomPerformers = ranked.length > 4 ? ranked.slice(-4).reverse() : [];

  // Recent activity — merged real timeline: quiz attempts, new learners, low-credit warning.
  const activity = [];
  quizAttempts.slice(0, 20).forEach(a => {
    const learner = learnerById.get(String(a.userId));
    activity.push({
      text: `${learner?.name || 'A learner'} ${a.passed ? 'passed' : 'attempted'} a quiz — score ${a.totalScore}/100`,
      date: a.createdAt,
    });
  });
  learners
    .filter(l => l.createdAt && new Date(l.createdAt) >= monthAgo)
    .forEach(l => activity.push({ text: `${l.name} added as a new learner`, date: l.createdAt }));
  if (totalCredits > 0 && creditsLeft <= totalCredits * LOW_CREDIT_RATIO) {
    activity.push({ text: `Credits low — ${creditsLeft} remaining of ${totalCredits}`, date: now });
  }
  activity.sort((a, b) => new Date(b.date) - new Date(a.date));

  return {
    learnerCount: learners.length,
    newLearnersThisMonth: learners.filter(l => l.createdAt && new Date(l.createdAt) >= monthAgo).length,
    coursesAssignedCount: orgCourses.length,
    newCoursesThisMonth: orgCourses.filter(oc => oc.createdAt && new Date(oc.createdAt) >= monthAgo).length,
    completionRate,
    totalCredits,
    creditsLeft,
    isLowOnCredits: totalCredits > 0 && creditsLeft <= totalCredits * LOW_CREDIT_RATIO,
    courseCompletion,
    topPerformers,
    bottomPerformers,
    activity: activity.slice(0, 8),
  };
};
