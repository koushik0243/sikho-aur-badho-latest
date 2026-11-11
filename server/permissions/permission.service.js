import Permission from './permission.model.js';

const ACTIONS = ['add', 'edit', 'view', 'delete'];

const MENU_ITEMS = [
    // Overview
    { key: 'dashboard',             label: 'Dashboard' },
    // Courses
    { key: 'category_subcategory',  label: 'Category / Sub-Category' },
    { key: 'tags',                  label: 'Tags' },
    { key: 'course_builder',        label: 'Course Builder' },
    { key: 'certificate_template',  label: 'Certificate Template' },
    // Organizations
    { key: 'organizations',         label: 'Organizations' },
    { key: 'assign_user',           label: 'Assign User' },
    { key: 'assign_course',         label: 'Assign Course' },
    { key: 'assign_credit',         label: 'Assign Credit' },
    { key: 'industry_type',         label: 'Industry Type' },
    { key: 'credits',               label: 'Credits' },
    { key: 'employees',             label: 'User (Employees)' },
    // Payments
    { key: 'orders',                label: 'Orders' },
    { key: 'invoices',              label: 'Invoices' },
    // Users
    { key: 'users',                 label: 'Users' },
    // Settings
    { key: 'roles',                 label: 'Roles' },
    { key: 'permissions',           label: 'Permissions' },
    { key: 'assign_role',           label: 'Assign Role' },
    { key: 'support_tickets',       label: 'Support Tickets' },
];

const toDisplayAction = (action) => action.charAt(0).toUpperCase() + action.slice(1);

const buildSeedPermissions = () => {
    const seedPermissions = [];

    for (const menu of MENU_ITEMS) {
        for (const action of ACTIONS) {
            seedPermissions.push({
                name: `${action}_${menu.key}`,
                display_name: `${toDisplayAction(action)} ${menu.label}`,
                desc: `${toDisplayAction(action)} permission for ${menu.label}`,
                status: 'active',
                deletedAt: null
            });
        }
    }

    return seedPermissions;
};

const buildPermissionQuery = (filters = {}) => {
    const query = {
        deletedAt: null
    };

    if (filters.status) {
        query.status = filters.status;
    }

    return query;
};

export const createPermission = async (newPermission) => {
    try {
        return await new Permission({
            name: newPermission?.name,
            display_name: newPermission?.display_name,
            desc: newPermission?.desc,
            status: newPermission?.status || 'active'
        }).save();
    } catch (error) {
        throw error;
    }
};

export const editPermission = async (editId) => {
    try {
        return await Permission.findOne({ _id: editId, deletedAt: null }).lean();
    } catch (error) {
        throw error;
    }
};

export const updatePermission = async (updateId, updatePermissionData) => {
    try {
        const { name, display_name, desc, status } = updatePermissionData;
        const updateFields = {};

        if (name !== undefined) updateFields.name = name;
        if (display_name !== undefined) updateFields.display_name = display_name;
        if (desc !== undefined) updateFields.desc = desc;
        if (status !== undefined) updateFields.status = status;

        if (Object.keys(updateFields).length === 0) {
            return await Permission.findOne({ _id: updateId, deletedAt: null }).lean();
        }

        return await Permission.findOneAndUpdate(
            { _id: updateId, deletedAt: null },
            {
                $set: updateFields
            },
            { returnDocument: 'before', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listPermission = async (filters = {}) => {
    try {
        const query = buildPermissionQuery(filters);
        return await Permission.find(query).sort({ display_name: 1, name: 1 }).lean();
    } catch (error) {
        throw error;
    }
};

export const listPermissionPagination = async (page, limit, filters = {}) => {
    try {
        const query = buildPermissionQuery(filters);
        return await Permission.find(query)
            .sort({ display_name: 1, name: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
    } catch (error) {
        throw error;
    }
};

export const getPermissionCount = async (filters = {}) => {
    try {
        const query = buildPermissionQuery(filters);
        return await Permission.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

export const deletePermission = async (delId) => {
    try {
        return await Permission.findOneAndUpdate(
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

export const seedPermissions = async () => {
    try {
        const permissions = buildSeedPermissions();

        const operations = permissions.map((permission) => ({
            updateOne: {
                filter: { name: permission.name },
                update: {
                    $set: {
                        display_name: permission.display_name,
                        desc: permission.desc,
                        status: permission.status,
                        deletedAt: null
                    },
                    $setOnInsert: {
                        name: permission.name
                    }
                },
                upsert: true
            }
        }));

        const result = await Permission.bulkWrite(operations);

        return {
            totalSeedPermissions: permissions.length,
            insertedCount: result.upsertedCount || 0,
            modifiedCount: result.modifiedCount || 0,
            matchedCount: result.matchedCount || 0
        };
    } catch (error) {
        throw error;
    }
};