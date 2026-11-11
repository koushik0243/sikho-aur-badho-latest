import express from 'express';
import * as CourseAssignmentHelper from './course_assignment.service.js';
import { sendEmail } from '../_helpers/sendEmail.js';

const Router = express.Router();

const createCourseAssignment = async (req, res, next) => {
    try {
        const data = await CourseAssignmentHelper.createCourseAssignment(req.body);
        res.status(200).json({ status: 200, message: "Successfully added.", data });

        // Send email notification (non-blocking — response already sent)
        try {
            const populated = await CourseAssignmentHelper.editCourseAssignment(data._id);
            const userEmail = populated?.userId?.email;
            const userName  = populated?.userId?.name || 'Learner';
            const courseTitle = populated?.courseId?.title || 'a course';
            if (userEmail) {
                const assignedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
                await sendEmail(
                    userEmail,
                    `📚 New Course Assigned: ${courseTitle}`,
                    `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0b7b7b;padding:32px 40px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">sikhø <span style="color:#a8e6e6;">aur</span> badhø</div>
            <div style="font-size:12px;color:#a8e6e6;margin-top:4px;letter-spacing:0.05em;text-transform:uppercase;">Learning Management System</div>
          </td>
        </tr>

        <!-- Hero banner -->
        <tr>
          <td style="background:#e8f5f5;padding:24px 40px;text-align:center;border-bottom:1px solid #d0eaea;">
            <div style="font-size:36px;margin-bottom:8px;">📚</div>
            <div style="font-size:18px;font-weight:700;color:#0b7b7b;">New Course Assigned!</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:15px;color:#1a2b2b;">Hi <strong>${userName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:14px;color:#4a6060;line-height:1.7;">
              Great news! A new course has been assigned to you. Log in to your learning portal to get started and track your progress.
            </p>

            <!-- Course card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9f9;border:1px solid #c8e8e8;border-radius:10px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <div style="font-size:11px;font-weight:600;color:#0b7b7b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Course</div>
                  <div style="font-size:18px;font-weight:700;color:#0d2020;">${courseTitle}</div>
                  <div style="margin-top:12px;font-size:12px;color:#6a8080;">
                    📅 Assigned on: <strong>${assignedDate}</strong>
                  </div>
                </td>
              </tr>
            </table>

            <!-- CTA button -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="#" style="display:inline-block;background:#0b7b7b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 36px;border-radius:8px;letter-spacing:0.02em;">
                    Start Learning →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:28px 0 0;font-size:13px;color:#9aadad;line-height:1.6;">
              If you have any questions, please reach out to your store administrator.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fbfb;border-top:1px solid #e8edf0;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9aadad;">© ${new Date().getFullYear()} sikhø aur badhø — Learning Management System</p>
            <p style="margin:6px 0 0;font-size:11px;color:#bcc8c8;">This email was sent because a course was assigned to your account.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
                );
            }
        } catch (_) {
            // email errors must not fail the API response
        }
    } catch (error) {
        next(error);
    }
};

const editCourseAssignment = async (req, res, next) => {
    try {
        const data = await CourseAssignmentHelper.editCourseAssignment(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateCourseAssignment = async (req, res, next) => {
    try {
        const data = await CourseAssignmentHelper.updateCourseAssignment(req.params.id, req.body);
        res.status(200).json({ status: 200, message: "Successfully updated.", data });
    } catch (error) {
        next(error);
    }
};

const listCourseAssignment = async (req, res, next) => {
    try {
        const { organizationId, userId, courseId, topicId, passed } = req.query;
        const data = await CourseAssignmentHelper.listCourseAssignment({ organizationId, userId, courseId, topicId, passed });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listCourseAssignmentPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { organizationId, userId, courseId, topicId, passed } = req.query;

        const [assignments, total] = await Promise.all([
            CourseAssignmentHelper.listCourseAssignmentPagination(page, limit, { organizationId, userId, courseId, topicId, passed }),
            CourseAssignmentHelper.getCourseAssignmentCount({ organizationId, userId, courseId, topicId, passed })
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: assignments,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        next(error);
    }
};

const deleteCourseAssignment = async (req, res, next) => {
    try {
        const data = await CourseAssignmentHelper.deleteCourseAssignment(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

Router.post('/create', createCourseAssignment);
Router.get('/list', listCourseAssignment);
Router.get('/list-pagination', listCourseAssignmentPagination);
Router.get('/edit/:id', editCourseAssignment);
Router.put('/update/:id', updateCourseAssignment);
Router.get('/delete/:id', deleteCourseAssignment);
Router.get('/:id', editCourseAssignment);

export default Router;
