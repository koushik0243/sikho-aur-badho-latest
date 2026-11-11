import Role from './role.model.js';

const buildRoleQuery = (filters = {}) => {
    const query = { deletedAt: null };

    if (filters.status) query.status = filters.status;
    if (filters.user_type) query.user_type = filters.user_type;
    // organizationId filter: pass null explicitly to match superadmin-scoped roles
    if (filters.organizationId !== undefined) query.organizationId = filters.organizationId || null;

    return query;
};

export const createRole = async (newRole) => {
    try {
        const orgId = newRole.organizationId || null;
        const userType = newRole.user_type || 'superadmin';

        // If an active role with this name already exists in the same scope, reject
        const active = await Role.findOne({
            name: { $regex: `^${newRole.name}$`, $options: 'i' },
            organizationId: orgId,
            deletedAt: null,
        }).select('_id').lean();
        if (active) {
            const err = new Error('A role with this name already exists.');
            err.statusCode = 400;
            throw err;
        }

        // If a soft-deleted record with the same name/scope exists, restore it
        const deleted = await Role.findOne({ name: newRole.name, organizationId: orgId, deletedAt: { $ne: null } }).select('_id').lean();
        if (deleted) {
            return await Role.findOneAndUpdate(
                { _id: deleted._id },
                { $set: { display_name: newRole.display_name, desc: newRole.desc || '', status: newRole.status || 'active', user_type: userType, organizationId: orgId, deletedAt: null, updatedAt: new Date() } },
                { returnDocument: 'after' }
            );
        }
        return await new Role({
            name: newRole?.name,
            display_name: newRole?.display_name,
            desc: newRole?.desc,
            status: newRole?.status || 'active',
            user_type: userType,
            organizationId: orgId,
        }).save();
    } catch (error) {
        if (error.code === 11000) {
            const err = new Error('A role with this name already exists.');
            err.statusCode = 400;
            throw err;
        }
        throw error;
    }
};

export const editRole = async (editId) => {
    try {
        return await Role.findOne({ _id: editId, deletedAt: null }).lean();
    } catch (error) {
        throw error;
    }
};

export const updateRole = async (updateId, updateRoleData) => {
    try {
        const { name, display_name, desc, status } = updateRoleData;

        const current = await Role.findOne({ _id: updateId, deletedAt: null }).lean();
        if (!current) {
            const err = new Error('Role not found.');
            err.statusCode = 404;
            throw err;
        }

        const updateFields = {};

        // Only write name when it actually changed — avoids touching the unique index
        // when the name is unchanged, and prevents false E11000 errors from a stale
        // non-partial index that may exist in older database installations.
        if (name !== undefined && name !== current.name) {
            const duplicate = await Role.findOne({
                name: { $regex: `^${name}$`, $options: 'i' },
                deletedAt: null,
                _id: { $ne: updateId },
            }).select('_id').lean();
            if (duplicate) {
                const err = new Error('A role with this name already exists.');
                err.statusCode = 400;
                throw err;
            }
            updateFields.name = name;
        }

        if (display_name !== undefined) updateFields.display_name = display_name;
        if (desc !== undefined) updateFields.desc = desc;
        if (status !== undefined) updateFields.status = status;
        if (updateRoleData.user_type !== undefined) updateFields.user_type = updateRoleData.user_type;
        if (updateRoleData.organizationId !== undefined) updateFields.organizationId = updateRoleData.organizationId || null;

        if (Object.keys(updateFields).length === 0) {
            return current;
        }

        updateFields.updatedAt = new Date();
        return await Role.findOneAndUpdate(
            { _id: updateId, deletedAt: null },
            { $set: updateFields },
            { returnDocument: 'after' }
        ).lean();
    } catch (error) {
        if (error.code === 11000) {
            const err = new Error('A role with this name already exists.');
            err.statusCode = 400;
            throw err;
        }
        throw error;
    }
};

export const listRole = async (filters = {}) => {
    try {
        const query = buildRoleQuery(filters);
        return await Role.find(query).populate('organizationId', 'org_name').sort({ _id: 1 }).lean();
    } catch (error) {
        throw error;
    }
};

export const listRolePagination = async (page, limit, filters = {}) => {
    try {
        const query = buildRoleQuery(filters);
        return await Role.find(query)
            .populate('organizationId', 'org_name')
            .sort({ display_name: 1, name: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
    } catch (error) {
        throw error;
    }
};

export const getRoleCount = async (filters = {}) => {
    try {
        const query = buildRoleQuery(filters);
        return await Role.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

export const checkRoleName = async (name, excludeId = null) => {
    try {
        const query = { name: { $regex: `^${name}$`, $options: 'i' }, deletedAt: null };
        if (excludeId) {
            query._id = { $ne: excludeId };
        }
        const existing = await Role.findOne(query).select('_id').lean();
        return { isDuplicate: !!existing };
    } catch (error) {
        throw error;
    }
};

export const deleteRole = async (delId) => {
    try {
        return await Role.findOneAndUpdate(
            { _id: delId, deletedAt: null },
            {
                $set: {
                    deletedAt: new Date(),
                    status: 'inactive'
                }
            },
            { returnDocument: 'before' }
        ).lean();
    } catch (error) {
        throw error;
    }
};