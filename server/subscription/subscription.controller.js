import express from 'express';
import * as SubscriptionHelper from './subscription.service.js';

const Router = express.Router();

const createSubscription = async (req, res, next) => {
    try {
        const data = await SubscriptionHelper.createSubscription(req.body);
        res.status(200).json({ status: 200, message: "Successfully added.", data });
    } catch (error) {
        next(error);
    }
};

const editSubscription = async (req, res, next) => {
    try {
        const data = await SubscriptionHelper.editSubscription(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateSubscription = async (req, res, next) => {
    try {
        const data = await SubscriptionHelper.updateSubscription(req.params.id, req.body);
        res.status(200).json({ status: 200, message: "Successfully updated.", data });
    } catch (error) {
        next(error);
    }
};

const listSubscription = async (req, res, next) => {
    try {
        const { status, organizationId, planId } = req.query;
        const data = await SubscriptionHelper.listSubscription({ status, organizationId, planId });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listSubscriptionPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status, organizationId, planId } = req.query;

        const [subscriptions, total] = await Promise.all([
            SubscriptionHelper.listSubscriptionPagination(page, limit, { status, organizationId, planId }),
            SubscriptionHelper.getSubscriptionCount({ status, organizationId, planId }),
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: subscriptions,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        next(error);
    }
};

const deleteSubscription = async (req, res, next) => {
    try {
        const data = await SubscriptionHelper.deleteSubscription(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

Router.post('/create', createSubscription);
Router.get('/list', listSubscription);
Router.get('/list-pagination', listSubscriptionPagination);
Router.get('/edit/:id', editSubscription);
Router.put('/update/:id', updateSubscription);
Router.get('/delete/:id', deleteSubscription);
Router.get('/:id', editSubscription);

export default Router;
