import express from 'express';
import * as OrderHelper from './order.service.js';

const Router = express.Router();

const createOrder = async (req, res, next) => {
    try {
        const data = await OrderHelper.createOrder(req.body);
        res.status(200).json({ status: 200, message: "Successfully added.", data });
    } catch (error) {
        next(error);
    }
};

const editOrder = async (req, res, next) => {
    try {
        const data = await OrderHelper.editOrder(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateOrder = async (req, res, next) => {
    try {
        const data = await OrderHelper.updateOrder(req.params.id, req.body);
        res.status(200).json({ status: 200, message: "Successfully updated.", data });
    } catch (error) {
        next(error);
    }
};

const listOrder = async (req, res, next) => {
    try {
        const { status, organizer_id, credit_id, date_from, date_to } = req.query;
        const data = await OrderHelper.listOrder({ status, organizer_id, credit_id, date_from, date_to });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listOrderPagination = async (req, res, next) => {
    try {
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status, organizer_id, credit_id, date_from, date_to } = req.query;

        const [orders, total] = await Promise.all([
            OrderHelper.listOrderPagination(page, limit, { status, organizer_id, credit_id, date_from, date_to }),
            OrderHelper.getOrderCount({ status, organizer_id, credit_id, date_from, date_to }),
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: orders,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
        });
    } catch (error) {
        next(error);
    }
};

const deleteOrder = async (req, res, next) => {
    try {
        const data = await OrderHelper.deleteOrder(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

Router.post('/create',           createOrder);
Router.get('/list',              listOrder);
Router.get('/list-pagination',   listOrderPagination);
Router.get('/edit/:id',          editOrder);
Router.put('/update/:id',        updateOrder);
Router.get('/delete/:id',        deleteOrder);
Router.get('/:id',               editOrder);

export default Router;
