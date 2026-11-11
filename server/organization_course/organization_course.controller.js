import express from 'express';
import * as OrganizationCourseHelper from './organization_course.service.js';

const Router = express.Router();

const createOrganizationCourse = async (req, res, next) => {
    try {
        const data = await OrganizationCourseHelper.createOrganizationCourse(req.body);
        res.status(200).json({ status: 200, message: "Successfully added.", data });
    } catch (error) {
        next(error);
    }
};

const editOrganizationCourse = async (req, res, next) => {
    try {
        const data = await OrganizationCourseHelper.editOrganizationCourse(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateOrganizationCourse = async (req, res, next) => {
    try {
        const data = await OrganizationCourseHelper.updateOrganizationCourse(req.params.id, req.body);
        res.status(200).json({ status: 200, message: "Successfully updated.", data });
    } catch (error) {
        next(error);
    }
};

const listOrganizationCourse = async (req, res, next) => {
    try {
        const { status, orgId, courseId, coursePriceId } = req.query;
        const data = await OrganizationCourseHelper.listOrganizationCourse({ status, orgId, courseId, coursePriceId });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listOrganizationCoursePagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status, orgId, courseId, coursePriceId } = req.query;

        const [organizationCourses, total] = await Promise.all([
            OrganizationCourseHelper.listOrganizationCoursePagination(page, limit, { status, orgId, courseId, coursePriceId }),
            OrganizationCourseHelper.getOrganizationCourseCount({ status, orgId, courseId, coursePriceId })
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: organizationCourses,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        next(error);
    }
};

const deleteOrganizationCourse = async (req, res, next) => {
    try {
        const data = await OrganizationCourseHelper.deleteOrganizationCourse(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

Router.post('/create', createOrganizationCourse);
Router.get('/list', listOrganizationCourse);
Router.get('/list-pagination', listOrganizationCoursePagination);
Router.get('/edit/:id', editOrganizationCourse);
Router.put('/update/:id', updateOrganizationCourse);
Router.get('/delete/:id', deleteOrganizationCourse);
Router.get('/:id', editOrganizationCourse);

export default Router;
