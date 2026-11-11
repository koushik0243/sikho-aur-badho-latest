import express from 'express';
import * as InvoiceHelper from './invoice.service.js';
import { findPaymentMethodBySlug } from '../payment_methods/payment_method.service.js';

const Router = express.Router();

// body.payment_method must be the slug of a payment method from Payments →
// Manage Payment Method (empty = none). Normalises it; returns an error message
// if it isn't one.
async function checkPaymentMethod(body) {
    if (!body || body.payment_method === undefined || body.payment_method === null) return null;
    const slug = String(body.payment_method).trim().toLowerCase();
    if (slug === '') { body.payment_method = null; return null; }
    if (!(await findPaymentMethodBySlug(slug))) return 'Please choose a payment method from the list.';
    body.payment_method = slug;
    return null;
}

const createInvoice = async (req, res, next) => {
    try {
        const methodError = await checkPaymentMethod(req.body);
        if (methodError) return res.status(400).json({ status: 400, message: methodError });
        const data = await InvoiceHelper.createInvoice(req.body);
        res.status(200).json({ status: 200, message: "Successfully added.", data });
    } catch (error) {
        next(error);
    }
};

const editInvoice = async (req, res, next) => {
    try {
        const data = await InvoiceHelper.editInvoice(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateInvoice = async (req, res, next) => {
    try {
        const methodError = await checkPaymentMethod(req.body);
        if (methodError) return res.status(400).json({ status: 400, message: methodError });
        const data = await InvoiceHelper.updateInvoice(req.params.id, req.body);
        res.status(200).json({ status: 200, message: "Successfully updated.", data });
    } catch (error) {
        next(error);
    }
};

const listInvoice = async (req, res, next) => {
    try {
        const { status, payment_status, org_id, order_id, date_from, date_to } = req.query;
        const data = await InvoiceHelper.listInvoice({ status, payment_status, org_id, order_id, date_from, date_to });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listInvoicePagination = async (req, res, next) => {
    try {
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status, payment_status, org_id, order_id, date_from, date_to } = req.query;

        const [invoices, total] = await Promise.all([
            InvoiceHelper.listInvoicePagination(page, limit, { status, payment_status, org_id, order_id, date_from, date_to }),
            InvoiceHelper.getInvoiceCount({ status, payment_status, org_id, order_id, date_from, date_to }),
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: invoices,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
        });
    } catch (error) {
        next(error);
    }
};

const deleteInvoice = async (req, res, next) => {
    try {
        const data = await InvoiceHelper.deleteInvoice(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

Router.post('/create',          createInvoice);
Router.get('/list',             listInvoice);
Router.get('/list-pagination',  listInvoicePagination);
Router.get('/edit/:id',         editInvoice);
Router.put('/update/:id',       updateInvoice);
Router.get('/delete/:id',       deleteInvoice);
Router.get('/:id',              editInvoice);

export default Router;
