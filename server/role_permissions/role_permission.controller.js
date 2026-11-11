import express from 'express';
import * as RolePermissionHelper from './role_permission.service.js';

const Router = express.Router();

const createRolePermission = async (req, res, next) => {
    try {
        const data = await RolePermissionHelper.createRolePermission(req.body);
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

const editRolePermission = async (req, res, next) => {
    try {
        const data = await RolePermissionHelper.editRolePermission(req.params.id);
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

const updateRolePermission = async (req, res, next) => {
    try {
        const data = await RolePermissionHelper.updateRolePermission(req.params.id, req.body);
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

const listRolePermission = async (req, res, next) => {
    try {
        const { role_id: roleId } = req.query;
        const data = await RolePermissionHelper.listRolePermission({ roleId });
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

const listRolePermissionPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { role_id: roleId } = req.query;

        const [rolePermissions, totalRolePermissions] = await Promise.all([
            RolePermissionHelper.listRolePermissionPagination(page, limit, { roleId }),
            RolePermissionHelper.getRolePermissionCount({ roleId })
        ]);
        const return_data = {
            status: 200,
            message: "Successfully fetched.",
            data: rolePermissions,
            total: totalRolePermissions,
            totalPages: Math.ceil(totalRolePermissions / limit),
            currentPage: page
        };
        res.status(200).json(return_data);
    } catch (error) {
        next(error);
    }
};

const deleteRolePermission = async (req, res, next) => {
    try {
        const data = await RolePermissionHelper.deleteRolePermission(req.params.id);
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

const getPermissionsByRole = async (req, res, next) => {
    try {
        const data = await RolePermissionHelper.getPermissionsByRole(req.params.roleId);
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

const bulkAssignPermissions = async (req, res, next) => {
    try {
        const { role_id, permission_ids } = req.body;

        if (!role_id) {
            return res.status(400).json({
                status: 400,
                message: "Role ID is required."
            });
        }

        const data = await RolePermissionHelper.bulkAssignPermissions(role_id, permission_ids || []);
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

Router.post('/', bulkAssignPermissions);
Router.post('/create', createRolePermission);
Router.post('/assign', bulkAssignPermissions);
Router.get('/edit/:id', editRolePermission);
Router.put('/update/:id', updateRolePermission);
Router.get('/list', listRolePermission);
Router.get('/by-role/:roleId', getPermissionsByRole);
Router.get('/delete/:id', deleteRolePermission);
Router.get('/list-pagination', listRolePermissionPagination);

export default Router;