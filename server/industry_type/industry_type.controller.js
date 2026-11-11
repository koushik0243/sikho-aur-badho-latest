import express from 'express';
import * as IndustryTypeHelper from './industry_type.service.js';

const Router = express.Router();

const checkName = async (req, res, next) => {
    try {
        const { name, excludeId } = req.query;
        const data = await IndustryTypeHelper.checkIndustryTypeName(name, excludeId || null);
        res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
    } catch (error) { next(error); }
};

const createIndustryType = async (req, res, next) => {
    try {
        const data = await IndustryTypeHelper.createIndustryType(req.body || {});
        res.status(200).json({ status: 200, message: 'Successfully added.', data });
    } catch (error) { next(error); }
};

const editIndustryType = async (req, res, next) => {
    try {
        const data = await IndustryTypeHelper.editIndustryType(req.params.id);
        res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
    } catch (error) { next(error); }
};

const updateIndustryType = async (req, res, next) => {
    try {
        const data = await IndustryTypeHelper.updateIndustryType(req.params.id, req.body || {});
        res.status(200).json({ status: 200, message: 'Successfully updated.', data });
    } catch (error) { next(error); }
};

const listAllIndustryTypes = async (req, res, next) => {
    try {
        const data = await IndustryTypeHelper.listAllIndustryTypes();
        res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
    } catch (error) { next(error); }
};

const listIndustryTypesPagination = async (req, res, next) => {
    try {
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 15;
        const { status, search } = req.query;
        const [data, total] = await Promise.all([
            IndustryTypeHelper.listIndustryTypesPagination(page, limit, { status, search }),
            IndustryTypeHelper.getIndustryTypeCount({ status, search })
        ]);
        res.status(200).json({
            status: 200,
            message: 'Successfully fetched.',
            data,
            total,
            totalPages:  Math.ceil(total / limit),
            currentPage: page,
        });
    } catch (error) { next(error); }
};

const deleteIndustryType = async (req, res, next) => {
    try {
        const data = await IndustryTypeHelper.deleteIndustryTypeTree(req.params.id);
        res.status(200).json({ status: 200, message: 'Successfully deleted.', data });
    } catch (error) { next(error); }
};

Router.get('/check',              checkName);
Router.post('/create',            createIndustryType);
Router.get('/list-all',           listAllIndustryTypes);
Router.get('/list-pagination',    listIndustryTypesPagination);
Router.get('/edit/:id',           editIndustryType);
Router.put('/update/:id',         updateIndustryType);
Router.get('/delete/:id',         deleteIndustryType);
Router.get('/:id',                editIndustryType);

export default Router;
