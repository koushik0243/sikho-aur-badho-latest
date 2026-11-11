import express from 'express';
import * as RoleHelper from './role.service.js';
import { assignPermissionsToRole } from '../role_permissions/role_permission.service.js';

const Router = express.Router();

const createRole = async (req, res, next) => {
    try {
        const data = await RoleHelper.createRole(req.body);
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

const editRole = async (req, res, next) => {
    try {
        const data = await RoleHelper.editRole(req.params.id);
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

const updateRole = async (req, res, next) => {
    try {
        const data = await RoleHelper.updateRole(req.params.id, req.body);
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

const listRole = async (req, res, next) => {
    try {
        const { status, user_type, orgId } = req.query;
        const filters = { status };
        if (user_type) filters.user_type = user_type;
        if (orgId !== undefined) filters.organizationId = orgId || null;
        const data = await RoleHelper.listRole(filters);
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

const listRolePagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status, user_type, orgId } = req.query;
        const filters = { status };
        if (user_type) filters.user_type = user_type;
        if (orgId !== undefined) filters.organizationId = orgId || null;

        const [roles, totalRoles] = await Promise.all([
            RoleHelper.listRolePagination(page, limit, filters),
            RoleHelper.getRoleCount(filters)
        ]);
        const return_data = {
            status: 200,
            message: "Successfully fetched.",
            data: roles,
            total: totalRoles,
            totalPages: Math.ceil(totalRoles / limit),
            currentPage: page
        };
        res.status(200).json(return_data);
    } catch (error) {
        next(error);
    }
};

const deleteRole = async (req, res, next) => {
    try {
        const data = await RoleHelper.deleteRole(req.params.id);
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

const checkRoleName = async (req, res, next) => {
    try {
        const { name, excludeId } = req.query;
        const data = await RoleHelper.checkRoleName(name, excludeId || null);
        const return_data = {
            status: 200,
            message: "Successfully checked.",
            data: data,
        };
        res.status(200).json(return_data);
    } catch (error) {
        next(error);
    }
};

const assignRolePermissions = async (req, res, next) => {
    try {
        const { permission_ids } = req.body;

        if (!Array.isArray(permission_ids)) {
            return res.status(400).json({
                status: 400,
                message: "permission_ids must be an array."
            });
        }

        const data = await assignPermissionsToRole(req.params.id, permission_ids);
        const return_data = {
            status: 200,
            message: "Permissions assigned successfully.",
            data: data,
        };
        res.status(200).json(return_data);
    } catch (error) {
        next(error);
    }
};

Router.post('/create', createRole);
Router.get('/edit/:id', editRole);
Router.put('/update/:id', updateRole);
Router.get('/list', listRole);
Router.get('/delete/:id', deleteRole);
Router.get('/list-pagination', listRolePagination);
Router.get('/check', checkRoleName);
Router.post('/:id/permissions', assignRolePermissions);
Router.get('/:id', editRole);

export default Router;