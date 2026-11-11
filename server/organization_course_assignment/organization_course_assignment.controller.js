import express from 'express';
import * as OrgCourseAssignmentHelper from './organization_course_assignment.service.js';

const Router = express.Router();

const createOrgCourseAssignment = async (req, res, next) => {
    try {
        const assignedBy = req.user?._id || null;
        const data = await OrgCourseAssignmentHelper.createOrgCourseAssignment(req.body, assignedBy);
        res.status(200).json({ status: 200, message: "Successfully added.", data });
    } catch (error) {
        next(error);
    }
};

const editOrgCourseAssignment = async (req, res, next) => {
    try {
        const data = await OrgCourseAssignmentHelper.editOrgCourseAssignment(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateOrgCourseAssignment = async (req, res, next) => {
    try {
        const data = await OrgCourseAssignmentHelper.updateOrgCourseAssignment(req.params.id, req.body);
        res.status(200).json({ status: 200, message: "Successfully updated.", data });
    } catch (error) {
        next(error);
    }
};

const listOrgCourseAssignment = async (req, res, next) => {
    try {
        const { status, orgId, courseId, assignedBy } = req.query;
        const data = await OrgCourseAssignmentHelper.listOrgCourseAssignment({ status, orgId, courseId, assignedBy });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listOrgCourseAssignmentPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status, orgId, courseId, assignedBy } = req.query;

        const [assignments, total] = await Promise.all([
            OrgCourseAssignmentHelper.listOrgCourseAssignmentPagination(page, limit, { status, orgId, courseId, assignedBy }),
            OrgCourseAssignmentHelper.getOrgCourseAssignmentCount({ status, orgId, courseId, assignedBy })
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

const deleteOrgCourseAssignment = async (req, res, next) => {
    try {
        const data = await OrgCourseAssignmentHelper.deleteOrgCourseAssignment(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

Router.post('/create', createOrgCourseAssignment);
Router.get('/list', listOrgCourseAssignment);
Router.get('/list-pagination', listOrgCourseAssignmentPagination);
Router.get('/edit/:id', editOrgCourseAssignment);
Router.put('/update/:id', updateOrgCourseAssignment);
Router.get('/delete/:id', deleteOrgCourseAssignment);
Router.get('/:id', editOrgCourseAssignment);

export default Router;
