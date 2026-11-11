import mongoose from 'mongoose';
import RolePermission from './role_permission.model.js';
import Role from '../roles/role.model.js';
import Permission from '../permissions/permission.model.js';

const { ObjectId } = mongoose.Types;

const buildRolePermissionQuery = (filters = {}) => {
    const query = {};

    if (filters.roleId && ObjectId.isValid(filters.roleId)) {
        query.role_id = new ObjectId(filters.roleId);
    }

    return query;
};

export const createRolePermission = async (newRolePermission) => {
    try {
        const payload = {
            role_id: newRolePermission?.role_id,
            permission_id: newRolePermission?.permission_id
        };

        return await new RolePermission(payload).save();
    } catch (error) {
        throw error;
    }
};

export const editRolePermission = async (editId) => {
    try {
        return await RolePermission.findById(editId)
            .populate('role_id')
            .populate('permission_id')
            .lean();
    } catch (error) {
        throw error;
    }
};

export const updateRolePermission = async (updateId, updateRolePermissionData) => {
    try {
        const { role_id, permission_id } = updateRolePermissionData;
        const updateFields = {};

        if (role_id && ObjectId.isValid(role_id)) {
            updateFields.role_id = role_id;
        }

        if (permission_id && ObjectId.isValid(permission_id)) {
            updateFields.permission_id = permission_id;
        }

        if (Object.keys(updateFields).length === 0) {
            return await RolePermission.findById(updateId)
                .populate('role_id')
                .populate('permission_id')
                .lean();
        }

        return await RolePermission.findByIdAndUpdate(
            updateId,
            {
                $set: updateFields
            },
            { returnDocument: 'before', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listRolePermission = async (filters = {}) => {
    try {
        const query = buildRolePermissionQuery(filters);

        return await RolePermission.find(query)
            .populate('role_id')
            .populate('permission_id')
            .sort({ _id: -1 })
            .lean();
    } catch (error) {
        throw error;
    }
};

export const listRolePermissionPagination = async (page, limit, filters = {}) => {
    try {
        const query = buildRolePermissionQuery(filters);

        return await RolePermission.find(query)
            .populate('role_id')
            .populate('permission_id')
            .sort({ _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
    } catch (error) {
        throw error;
    }
};

export const getRolePermissionCount = async (filters = {}) => {
    try {
        const query = buildRolePermissionQuery(filters);
        return await RolePermission.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

export const deleteRolePermission = async (delId) => {
    try {
        return await RolePermission.findByIdAndDelete(delId).lean();
    } catch (error) {
        throw error;
    }
};

export const getPermissionsByRole = async (roleId) => {
    try {
        if (!ObjectId.isValid(roleId)) {
            throw new Error('Invalid role ID');
        }

        return await RolePermission.find({ role_id: new ObjectId(roleId) })
            .populate({
                path: 'permission_id',
                select: '_id name display_name'
            })
            .sort({ _id: -1 })
            .lean();
    } catch (error) {
        throw error;
    }
};

export const bulkAssignPermissions = async (roleId, permissionIds) => {
    try {
        if (!ObjectId.isValid(roleId)) {
            throw new Error('Invalid role ID');
        }

        if (!Array.isArray(permissionIds)) {
            throw new Error('Permission IDs must be an array');
        }

        // Validate all permission IDs
        for (const permId of permissionIds) {
            if (!ObjectId.isValid(permId)) {
                throw new Error(`Invalid permission ID: ${permId}`);
            }
        }

        const roleObjectId = new ObjectId(roleId);
        const permissionObjectIds = permissionIds.map(id => new ObjectId(id));

        // Delete all existing permissions for this role
        await RolePermission.deleteMany({ role_id: roleObjectId });

        // Insert new permissions if any
        if (permissionObjectIds.length > 0) {
            const newPermissions = permissionObjectIds.map(permissionId => ({
                role_id: roleObjectId,
                permission_id: permissionId
            }));

            return await RolePermission.insertMany(newPermissions);
        }

        return { message: 'All permissions removed from role' };
    } catch (error) {
        throw error;
    }
};

export const assignPermissionsToRole = async (roleId, permissionIds) => {
    try {
        if (!ObjectId.isValid(roleId)) {
            const err = new Error('Invalid role ID');
            err.statusCode = 400;
            throw err;
        }

        if (!Array.isArray(permissionIds)) {
            const err = new Error('permission_ids must be an array');
            err.statusCode = 400;
            throw err;
        }

        for (const permId of permissionIds) {
            if (!ObjectId.isValid(permId)) {
                const err = new Error(`Invalid permission ID: ${permId}`);
                err.statusCode = 400;
                throw err;
            }
        }

        const role = await Role.findOne({ _id: roleId, deletedAt: null }).select('_id').lean();
        if (!role) {
            const err = new Error('Role not found');
            err.statusCode = 404;
            throw err;
        }

        if (permissionIds.length > 0) {
            const foundPermissions = await Permission.find({
                _id: { $in: permissionIds },
                deletedAt: null
            }).select('_id').lean();

            if (foundPermissions.length !== permissionIds.length) {
                const foundIds = foundPermissions.map(p => p._id.toString());
                const missing = permissionIds.filter(id => !foundIds.includes(id));
                const err = new Error(`Permission(s) not found: ${missing.join(', ')}`);
                err.statusCode = 404;
                throw err;
            }
        }

        const roleObjectId = new ObjectId(roleId);
        await RolePermission.deleteMany({ role_id: roleObjectId });

        if (permissionIds.length > 0) {
            const docs = permissionIds.map(permId => ({
                role_id: roleObjectId,
                permission_id: new ObjectId(permId)
            }));
            return await RolePermission.insertMany(docs);
        }

        return { message: 'All permissions removed from role' };
    } catch (error) {
        throw error;
    }
};