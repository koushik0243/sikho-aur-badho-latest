import express from 'express';
import * as CoursePricingHelper from './course_pricing.service.js';

const Router = express.Router();

const createCoursePricing = async (req, res, next) => {
    try {
        const data = await CoursePricingHelper.createCoursePricing(req.body);
        res.status(200).json({ status: 200, message: 'Successfully added.', data });
    } catch (error) {
        next(error);
    }
};

const editCoursePricing = async (req, res, next) => {
    try {
        const data = await CoursePricingHelper.editCoursePricing(req.params.id);
        res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
    } catch (error) {
        next(error);
    }
};

const updateCoursePricing = async (req, res, next) => {
    try {
        const data = await CoursePricingHelper.updateCoursePricing(req.params.id, req.body);
        res.status(200).json({ status: 200, message: 'Successfully updated.', data });
    } catch (error) {
        next(error);
    }
};

const listCoursePricing = async (req, res, next) => {
    try {
        const { status, courseId } = req.query;
        const data = await CoursePricingHelper.listCoursePricing({ status, courseId });
        res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
    } catch (error) {
        next(error);
    }
};

const listCoursePricingPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status, courseId } = req.query;
        const [data, total] = await Promise.all([
            CoursePricingHelper.listCoursePricingPagination(page, limit, { status, courseId }),
            CoursePricingHelper.getCoursePricingCount({ status, courseId })
        ]);
        res.status(200).json({
            status: 200,
            message: 'Successfully fetched.',
            data,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        next(error);
    }
};

const deleteCoursePricing = async (req, res, next) => {
    try {
        const data = await CoursePricingHelper.deleteCoursePricing(req.params.id);
        res.status(200).json({ status: 200, message: 'Successfully deleted.', data });
    } catch (error) {
        next(error);
    }
};

Router.post('/create',          createCoursePricing);
Router.get('/list',             listCoursePricing);
Router.get('/list-pagination',  listCoursePricingPagination);
Router.get('/edit/:id',         editCoursePricing);
Router.put('/update/:id',       updateCoursePricing);
Router.get('/delete/:id',       deleteCoursePricing);
Router.get('/:id',              editCoursePricing);

export default Router;
