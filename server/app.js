import dotenv from 'dotenv';
dotenv.config();
import './_helpers/db.js';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import protect, { requireSuperAdmin } from './middleware/authMiddleware.js';
// Which account types may use each API (super admin / store owner / learner): middleware/accountAccess.js
import { allowAccounts, ALL_ACCOUNTS, SUPERADMIN, STORE_OWNER, LEARNER } from './middleware/accountAccess.js';
import { guardUploads, mediaTokenRouter, mediaProtect } from './middleware/mediaAuth.js';
import { resumeVideoConversionsOnStartup } from './_helpers/resumeVideoConversions.js';

// Recreate __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//Routes inclusion
import chapterRouter from './chapters/chapter.controller.js';
import courseCategoryRouter from './course_category/course_category.controller.js';
import courseSubCategoryRouter from './course_subcategory/course_subcategory.controller.js';
import courseRouter from './courses/course.controller.js';
import topicRouter from './topics/topic.controller.js';
import courseAssignmentRouter from './course_assignments/course_assignment.controller.js';

import organizationRouter from './organizations/organization.controller.js';
import creditRouter from './credits/credit.controller.js';

import organizationCourseRouter from './organization_course/organization_course.controller.js';
import subscriptionRouter from './subscription/subscription.controller.js';
import coursePricingRouter from './course_pricing/course_pricing.controller.js';
import planRouter from './plans/plan.controller.js';
import organizationCourseAssignmentRouter from './organization_course_assignment/organization_course_assignment.controller.js';
import organizationCreditAssignmentRouter from './organization_credit_assignment/organization_credit_assignment.controller.js';

import industryTypeRouter from './industry_type/industry_type.controller.js';
import departmentRouter from './departments/department.controller.js';
import designationRouter from './designations/designation.controller.js';
import paymentMethodRouter from './payment_methods/payment_method.controller.js';
import reportRouter from './reports/report.controller.js';
import orgReportRouter from './reports/org_report.controller.js';
import myReportRouter from './reports/my_report.controller.js';
import topicActivityRouter, { submissionVideo } from './topic_activity/topic_activity.controller.js';
import tagRouter from './tags/tag.controller.js';
import certificateTemplateRouter from './certificate_template/certificate_template.controller.js';
import roleRouter from './roles/role.controller.js';
import permissionRouter from './permissions/permission.controller.js';
import rolePermissionRouter from './role_permissions/role_permission.controller.js';
import userRouter from './users/user.controller.js';
import orderRouter from './orders/order.controller.js';
import invoiceRouter from './invoices/invoice.controller.js';
import supportTicketRouter from './support_tickets/support_ticket.controller.js';
import creditUsedRouter from './credit_used/credit_used.controller.js';
import quizQuestionRouter from './quiz_questions/quiz_question.controller.js';
import quizAttemptRouter from './quiz_attempts/quiz_attempt.controller.js';
import aptitudeQuestionRouter from './aptitude_questions/aptitude_question.controller.js';
import aptitudeAttemptRouter from './aptitude_attempts/aptitude_attempt.controller.js';
import progressRouter from './progress/progress.controller.js';
import courseCompletionRouter from './course_completions/course_completion.controller.js';
import noteRouter from './notes/note.controller.js';
import reviewRouter from './reviews/review.controller.js';
import speechRouter from './speech/speech.controller.js';
import organizationSignupRouter from './organization_signup/organization_signup.controller.js';
import orgDashboardRouter from './org_dashboard/org_dashboard.controller.js';
import activityLogRouter from './activity_log/activity_log.controller.js';

const app = express();
// Gzip/deflate every response above ~1KB (JSON list/pagination payloads are the main
// beneficiary — every page in the app fetches one of these on load). Cheap CPU cost,
// large win on payload transfer time, especially over mobile/slow connections.
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'https://staging1.sikhoaurbadho.com',
    'https://api1.sikhoaurbadho.com',
];

app.use(cors({
   origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  // Range: the assignment-video access check fetches one byte before streaming (lib/assignmentSubmission.js).
  allowedHeaders: "Content-Type, Authorization, Origin, X-Requested-With, Accept, currency, timezone, country, Range",
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Serve uploaded files as static assets (must come after cors so CORS headers are applied).
// Course content (lesson videos/images, assignments, intro videos) needs a media token — see middleware/mediaAuth.js.
app.use('/uploads', guardUploads, express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/media', protect, mediaTokenRouter);

app.use('/course-category', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [SUPERADMIN] }), courseCategoryRouter);
app.use('/course-subcategory', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [SUPERADMIN] }), courseSubCategoryRouter);
app.use('/course', protect, allowAccounts({ read: ALL_ACCOUNTS, write: [SUPERADMIN] }), courseRouter);
app.use('/chapter', protect, allowAccounts({ read: ALL_ACCOUNTS, write: [SUPERADMIN] }), chapterRouter);
app.use('/topic', protect, allowAccounts({ read: ALL_ACCOUNTS, write: [SUPERADMIN] }), topicRouter);
app.use('/course-assignment', protect, allowAccounts({ read: ALL_ACCOUNTS, write: [SUPERADMIN, STORE_OWNER] }), courseAssignmentRouter);

app.use('/course-pricing', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [SUPERADMIN] }), coursePricingRouter);
app.use('/plan', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [SUPERADMIN] }), planRouter);
app.use('/subscription', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [SUPERADMIN, STORE_OWNER] }), subscriptionRouter);

app.use('/organization', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [SUPERADMIN], routes: { 'PUT /update': [SUPERADMIN, STORE_OWNER] } }), organizationRouter);
app.use('/credit', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [SUPERADMIN] }), creditRouter);

app.use('/organization-course', protect, allowAccounts({ read: ALL_ACCOUNTS, write: [SUPERADMIN], routes: { 'POST /create': [SUPERADMIN, STORE_OWNER] } }), organizationCourseRouter);
app.use('/organization-course-assignment', protect, allowAccounts({ read: [SUPERADMIN], write: [SUPERADMIN] }), organizationCourseAssignmentRouter);
app.use('/organization-credit-assignment', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [SUPERADMIN], routes: { 'POST /create': [SUPERADMIN, STORE_OWNER] } }), organizationCreditAssignmentRouter);
app.use('/industry-type', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [SUPERADMIN] }), industryTypeRouter);
app.use('/department', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [SUPERADMIN] }), departmentRouter);
app.use('/designation', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [SUPERADMIN] }), designationRouter);
app.use('/payment-method', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [SUPERADMIN] }), paymentMethodRouter);
app.use('/report', protect, requireSuperAdmin, reportRouter);
app.use('/org-report', protect, allowAccounts({ read: [STORE_OWNER], write: [STORE_OWNER] }), orgReportRouter); // store owner: own organization only
app.use('/my-report', protect, allowAccounts({ read: [LEARNER], write: [LEARNER] }), myReportRouter);   // learner: own data only
// Submitted assignment videos are streamed straight into <video> tags (seekable, no 2 GB
// download first), so this one route also accepts the media token; see mediaProtect.
app.get('/topic-activity/submissions/:id/video', mediaProtect, submissionVideo);
app.use('/topic-activity', protect, allowAccounts({ read: ALL_ACCOUNTS, write: [LEARNER], routes: { 'POST /review': [SUPERADMIN, STORE_OWNER], 'POST /video-comment': [SUPERADMIN, STORE_OWNER, LEARNER] } }), topicActivityRouter);
app.use('/tags', protect, allowAccounts({ read: [SUPERADMIN], write: [SUPERADMIN] }), tagRouter);
app.use('/certificate-template', protect, allowAccounts({ read: ALL_ACCOUNTS, write: [SUPERADMIN] }), certificateTemplateRouter);
app.use('/role', protect, allowAccounts({ read: [SUPERADMIN], write: [SUPERADMIN] }), roleRouter);
app.use('/permission', protect, allowAccounts({ read: [SUPERADMIN], write: [SUPERADMIN] }), permissionRouter);
app.use('/role-permission', protect, allowAccounts({ read: [SUPERADMIN], write: [SUPERADMIN] }), rolePermissionRouter);
app.use('/order', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [SUPERADMIN] }), orderRouter);
app.use('/invoice', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [SUPERADMIN] }), invoiceRouter);
app.use('/support-ticket', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [SUPERADMIN], routes: { 'POST /create': [SUPERADMIN, STORE_OWNER], 'GET /delete': [SUPERADMIN, STORE_OWNER] } }), supportTicketRouter);
app.use('/credit-used', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [SUPERADMIN], routes: { 'POST /create': [SUPERADMIN, STORE_OWNER] } }), creditUsedRouter);
app.use('/quiz-questions', protect, allowAccounts({ read: ALL_ACCOUNTS, write: [SUPERADMIN] }), quizQuestionRouter);
app.use('/quiz-attempt',   protect, allowAccounts({ read: ALL_ACCOUNTS, write: [LEARNER] }), quizAttemptRouter);
app.use('/aptitude-questions', protect, allowAccounts({ read: ALL_ACCOUNTS, write: [SUPERADMIN] }), aptitudeQuestionRouter);
app.use('/aptitude-attempt', protect, allowAccounts({ read: ALL_ACCOUNTS, write: [LEARNER] }), aptitudeAttemptRouter);
app.use('/progress',       protect, allowAccounts({ read: ALL_ACCOUNTS, write: [LEARNER] }), progressRouter);
app.use('/course-completion', protect, allowAccounts({ read: ALL_ACCOUNTS, write: [LEARNER] }), courseCompletionRouter);
app.use('/note', protect, allowAccounts({ read: [LEARNER], write: [LEARNER] }), noteRouter);
app.use('/review', protect, allowAccounts({ read: ALL_ACCOUNTS, write: [LEARNER] }), reviewRouter);
app.use('/speech', protect, allowAccounts({ read: ALL_ACCOUNTS, write: ALL_ACCOUNTS }), speechRouter);
// Public — self-service store owner signup, no auth required (creates its own org + owner account).
app.use('/signup', organizationSignupRouter);
app.use('/org-dashboard', protect, allowAccounts({ read: [SUPERADMIN, STORE_OWNER], write: [STORE_OWNER] }), orgDashboardRouter);
app.use('/activity-log', protect, allowAccounts({ read: ALL_ACCOUNTS, write: ALL_ACCOUNTS }), activityLogRouter);
app.use('/user', userRouter);

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    status: statusCode,
    message: error.message || 'Internal server error'
  });
});

const server = app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});

// Node allows 5 minutes by default to receive a whole request, which cuts off lesson-video
// uploads (up to 2 GB) on slower connections. Allow 1 hour. (A reverse proxy in front of
// this server, e.g. nginx client_max_body_size / timeouts, must allow 2 GB uploads too.)
const LONG_REQUEST_TIMEOUT_MS = 60 * 60 * 1000;
server.requestTimeout = LONG_REQUEST_TIMEOUT_MS;

// Videos still being converted to browser-safe MP4 when the server last stopped.
resumeVideoConversionsOnStartup();

