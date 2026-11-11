import express from 'express';
import * as CreditHelper from './credit.service.js';

const Router = express.Router();

const createCredit = async (req, res, next) => {
    try {
        const userId = req.user?._id || null;
        const data = await CreditHelper.createCredit(req.body, userId);
        res.status(200).json({ status: 200, message: "Successfully added.", data });
    } catch (error) {
        next(error);
    }
};

const editCredit = async (req, res, next) => {
    try {
        const data = await CreditHelper.editCredit(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateCredit = async (req, res, next) => {
    try {
        const data = await CreditHelper.updateCredit(req.params.id, req.body);
        res.status(200).json({ status: 200, message: "Successfully updated.", data });
    } catch (error) {
        next(error);
    }
};

const listCredit = async (req, res, next) => {
    try {
        const { status } = req.query;
        const data = await CreditHelper.listCredit({ status });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listCreditPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status } = req.query;

        const [credits, total] = await Promise.all([
            CreditHelper.listCreditPagination(page, limit, { status }),
            CreditHelper.getCreditCount({ status }),
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: credits,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        next(error);
    }
};

const deleteCredit = async (req, res, next) => {
    try {
        const data = await CreditHelper.deleteCredit(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

const checkCreditTitle = async (req, res, next) => {
    try {
        const { title, excludeId } = req.query;
        if (!title) {
            return res.status(400).json({ status: 400, message: "title is required." });
        }
        const data = await CreditHelper.checkCreditTitle(title, excludeId || null);
        res.status(200).json({ status: 200, message: "Successfully checked.", data });
    } catch (error) {
        next(error);
    }
};

Router.post('/create', createCredit);
Router.get('/list', listCredit);
Router.get('/list-pagination', listCreditPagination);
Router.get('/check', checkCreditTitle);
Router.get('/edit/:id', editCredit);
Router.put('/update/:id', updateCredit);
Router.get('/delete/:id', deleteCredit);
Router.get('/:id', editCredit);

export default Router;
