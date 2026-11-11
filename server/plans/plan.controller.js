import express from 'express';
import * as PlanHelper from './plan.service.js';

const Router = express.Router();

const createPlan = async (req, res, next) => {
    try {
        const userId = req.user?._id || null;
        const data = await PlanHelper.createPlan(req.body, userId);
        res.status(200).json({ status: 200, message: "Successfully added.", data });
    } catch (error) {
        next(error);
    }
};

const editPlan = async (req, res, next) => {
    try {
        const data = await PlanHelper.editPlan(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updatePlan = async (req, res, next) => {
    try {
        const data = await PlanHelper.updatePlan(req.params.id, req.body);
        res.status(200).json({ status: 200, message: "Successfully updated.", data });
    } catch (error) {
        next(error);
    }
};

const listPlan = async (req, res, next) => {
    try {
        const { status, billingCycle } = req.query;
        const data = await PlanHelper.listPlan({ status, billingCycle });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listPlanPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status, billingCycle } = req.query;

        const [plans, total] = await Promise.all([
            PlanHelper.listPlanPagination(page, limit, { status, billingCycle }),
            PlanHelper.getPlanCount({ status, billingCycle }),
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: plans,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        next(error);
    }
};

const deletePlan = async (req, res, next) => {
    try {
        const data = await PlanHelper.deletePlan(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

const checkPlanTitle = async (req, res, next) => {
    try {
        const { title, excludeId } = req.query;
        if (!title) {
            return res.status(400).json({ status: 400, message: "title is required." });
        }
        const data = await PlanHelper.checkPlanTitle(title, excludeId || null);
        res.status(200).json({ status: 200, message: "Successfully checked.", data });
    } catch (error) {
        next(error);
    }
};

Router.post('/create', createPlan);
Router.get('/list', listPlan);
Router.get('/list-pagination', listPlanPagination);
Router.get('/check', checkPlanTitle);
Router.get('/edit/:id', editPlan);
Router.put('/update/:id', updatePlan);
Router.get('/delete/:id', deletePlan);
Router.get('/:id', editPlan);

export default Router;
