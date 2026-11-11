import express from 'express';
import * as CreditUsedHelper from './credit_used.service.js';

const Router = express.Router();

const createCreditUsed = async (req, res, next) => {
    try {
        const data = await CreditUsedHelper.createCreditUsed(req.body);
        res.status(200).json({ status: 200, message: "Successfully added.", data });
    } catch (error) {
        next(error);
    }
};

const editCreditUsed = async (req, res, next) => {
    try {
        const data = await CreditUsedHelper.editCreditUsed(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateCreditUsed = async (req, res, next) => {
    try {
        const data = await CreditUsedHelper.updateCreditUsed(req.params.id, req.body);
        res.status(200).json({ status: 200, message: "Successfully updated.", data });
    } catch (error) {
        next(error);
    }
};

const listCreditUsed = async (req, res, next) => {
    try {
        const { orgId, learnerId, courseId, status } = req.query;
        const data = await CreditUsedHelper.listCreditUsed({ orgId, learnerId, courseId, status });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listCreditUsedPagination = async (req, res, next) => {
    try {
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { orgId, learnerId, courseId, status } = req.query;

        const [records, total] = await Promise.all([
            CreditUsedHelper.listCreditUsedPagination(page, limit, { orgId, learnerId, courseId, status }),
            CreditUsedHelper.getCreditUsedCount({ orgId, learnerId, courseId, status }),
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: records,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
        });
    } catch (error) {
        next(error);
    }
};

const deleteCreditUsed = async (req, res, next) => {
    try {
        const data = await CreditUsedHelper.deleteCreditUsed(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

Router.post('/create',          createCreditUsed);
Router.get('/list',             listCreditUsed);
Router.get('/list-pagination',  listCreditUsedPagination);
Router.get('/edit/:id',         editCreditUsed);
Router.put('/update/:id',       updateCreditUsed);
Router.get('/delete/:id',       deleteCreditUsed);
Router.get('/:id',              editCreditUsed);

export default Router;
