import express from 'express';
import mongoose from 'mongoose';
import * as DepartmentHelper from './department.service.js';

import { requireSuperAdmin } from '../middleware/authMiddleware.js';

const Router = express.Router();

const STATUSES = ['active', 'inactive'];
const NAME_MAX = 100;

const badRequest = (res, message) => res.status(400).json({ status: 400, message });
const notFound   = (res) => res.status(404).json({ status: 404, message: 'Department not found.' });
const validId    = (id) => mongoose.isValidObjectId(id);

// Shared create/update validation. `partial` lets update omit fields.
function validateBody(body, { partial = false } = {}) {
    const { name, status, description } = body;
    if (!partial || name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) return 'Department name is required.';
        if (name.trim().length > NAME_MAX) return `Department name must be ${NAME_MAX} characters or fewer.`;
    }
    if (status !== undefined && !STATUSES.includes(status)) return 'Status must be active or inactive.';
    if (description !== undefined && typeof description !== 'string') return 'Description must be text.';
    return null;
}

const checkName = async (req, res, next) => {
    try {
        const { name, excludeId } = req.query;
        if (!name) return badRequest(res, 'name is required.');
        const data = await DepartmentHelper.checkDepartmentName(name, validId(excludeId) ? excludeId : null);
        res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
    } catch (error) { next(error); }
};

const createDepartment = async (req, res, next) => {
    try {
        const body = req.body || {};
        const error = validateBody(body);
        if (error) return badRequest(res, error);
        if (await DepartmentHelper.checkDepartmentName(body.name)) {
            return res.status(409).json({ status: 409, message: 'A department with this name already exists.' });
        }
        const data = await DepartmentHelper.createDepartment(body);
        res.status(200).json({ status: 200, message: 'Successfully added.', data });
    } catch (error) { next(error); }
};

const editDepartment = async (req, res, next) => {
    try {
        if (!validId(req.params.id)) return notFound(res);
        const data = await DepartmentHelper.editDepartment(req.params.id);
        if (!data) return notFound(res);
        res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
    } catch (error) { next(error); }
};

const updateDepartment = async (req, res, next) => {
    try {
        if (!validId(req.params.id)) return notFound(res);
        const body = req.body || {};
        const error = validateBody(body, { partial: true });
        if (error) return badRequest(res, error);
        if (body.name !== undefined && await DepartmentHelper.checkDepartmentName(body.name, req.params.id)) {
            return res.status(409).json({ status: 409, message: 'A department with this name already exists.' });
        }
        const data = await DepartmentHelper.updateDepartment(req.params.id, body);
        if (!data) return notFound(res);
        res.status(200).json({ status: 200, message: 'Successfully updated.', data });
    } catch (error) { next(error); }
};

// Every department (optionally ?status=active) — for dropdowns.
const listDepartments = async (req, res, next) => {
    try {
        const status = STATUSES.includes(req.query.status) ? req.query.status : undefined;
        const data = await DepartmentHelper.listDepartments({ status });
        res.status(200).json({ status: 200, message: 'Successfully fetched.', data });
    } catch (error) { next(error); }
};

const listDepartmentsPagination = async (req, res, next) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 15));
        const status = STATUSES.includes(req.query.status) ? req.query.status : undefined;
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
        const [data, total] = await Promise.all([
            DepartmentHelper.listDepartmentsPagination(page, limit, { status, search }),
            DepartmentHelper.getDepartmentCount({ status, search }),
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

const deleteDepartment = async (req, res, next) => {
    try {
        if (!validId(req.params.id)) return notFound(res);
        const data = await DepartmentHelper.deleteDepartment(req.params.id);
        if (!data) return notFound(res);
        res.status(200).json({ status: 200, message: 'Successfully deleted.', data });
    } catch (error) { next(error); }
};

Router.get('/check',           checkName);
Router.post('/create',         requireSuperAdmin, createDepartment);
Router.get('/list',            listDepartments);
Router.get('/list-pagination', listDepartmentsPagination);
Router.get('/edit/:id',        editDepartment);
Router.put('/update/:id',      requireSuperAdmin, updateDepartment);
Router.get('/delete/:id',      requireSuperAdmin, deleteDepartment);
Router.get('/:id',             editDepartment);

export default Router;
