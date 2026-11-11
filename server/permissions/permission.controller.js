import express from 'express';
import * as PermissionHelper from './permission.service.js';

const Router = express.Router();

const createPermission = async (req, res, next) => {
    try {
        const data = await PermissionHelper.createPermission(req.body);
        const return_data = {
            status: 200,
            message: "Successfully added.",
            data: data,
        };
        res.status(200).json(return_data);
    } catch (error) {
        next(error);
    }
};

const editPermission = async (req, res, next) => {
    try {
        const data = await PermissionHelper.editPermission(req.params.id);
        const return_data = {
            status: 200,
            message: "Successfully fetched.",
            data: data,
        };
        res.status(200).json(return_data);
    } catch (error) {
        next(error);
    }
};

const updatePermission = async (req, res, next) => {
    try {
        const data = await PermissionHelper.updatePermission(req.params.id, req.body);
        const return_data = {
            status: 200,
            message: "Successfully updated.",
            data: data,
        };
        res.status(200).json(return_data);
    } catch (error) {
        next(error);
    }
};

const listPermission = async (req, res, next) => {
    try {
        const { status } = req.query;
        const data = await PermissionHelper.listPermission({ status });
        const return_data = {
            status: 200,
            message: "Successfully fetched.",
            data: data,
        };
        res.status(200).json(return_data);
    } catch (error) {
        next(error);
    }
};

const listPermissionPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status } = req.query;

        const [permissions, totalPermissions] = await Promise.all([
            PermissionHelper.listPermissionPagination(page, limit, { status }),
            PermissionHelper.getPermissionCount({ status })
        ]);
        const return_data = {
            status: 200,
            message: "Successfully fetched.",
            data: permissions,
            total: totalPermissions,
            totalPages: Math.ceil(totalPermissions / limit),
            currentPage: page
        };
        res.status(200).json(return_data);
    } catch (error) {
        next(error);
    }
};

const deletePermission = async (req, res, next) => {
    try {
        const data = await PermissionHelper.deletePermission(req.params.id);
        const return_data = {
            status: 200,
            message: "Successfully deleted.",
            data: data,
        };
        res.status(200).json(return_data);
    } catch (error) {
        next(error);
    }
};

const seedPermission = async (req, res, next) => {
    try {
        const data = await PermissionHelper.seedPermissions();
        const return_data = {
            status: 200,
            message: "Permissions seeded successfully.",
            data: data,
        };
        res.status(200).json(return_data);
    } catch (error) {
        next(error);
    }
};

Router.post('/create', createPermission);
Router.post('/seed', seedPermission);
Router.get('/edit/:id', editPermission);
Router.put('/update/:id', updatePermission);
Router.get('/list', listPermission);
Router.get('/delete/:id', deletePermission);
Router.get('/list-pagination', listPermissionPagination);
Router.get('/:id', editPermission);

export default Router;