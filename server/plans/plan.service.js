import slugify from 'slugify';
import Plan from './plan.model.js';

const generateSlug = (title) => slugify(title, { lower: true, strict: true, trim: true });

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null };
    if (filters.status) query.status = filters.status;
    if (filters.billingCycle) query.billingCycle = filters.billingCycle;
    return query;
};

export const createPlan = async (data, userId) => {
    try {
        const slug = generateSlug(data.title);
        return await new Plan({
            title: data.title,
            slug,
            desc: data.desc,
            price: data.price,
            billingCycle: data.billingCycle || 'monthly',
            maxUsers: data.maxUsers || 0,
            maxCourses: data.maxCourses || 0,
            storageLimit: data.storageLimit || 0,
            certificates: data.certificates !== undefined ? data.certificates : true,
            analytics: data.analytics !== undefined ? data.analytics : false,
            createdBy: userId,
            status: data.status || 'active'
        }).save();
    } catch (error) {
        throw error;
    }
};

export const editPlan = async (editId) => {
    try {
        return await Plan.findOne({ _id: editId, deletedAt: null }).lean();
    } catch (error) {
        throw error;
    }
};

export const updatePlan = async (updateId, data) => {
    try {
        const fields = [
            'desc', 'price', 'billingCycle', 'maxUsers', 'maxCourses',
            'storageLimit', 'certificates', 'analytics', 'status'
        ];
        const updateFields = {};

        if (data.title !== undefined) {
            updateFields.title = data.title;
            updateFields.slug = generateSlug(data.title);
        }
        for (const field of fields) {
            if (data[field] !== undefined) updateFields[field] = data[field];
        }

        if (Object.keys(updateFields).length === 0) {
            return await Plan.findOne({ _id: updateId, deletedAt: null }).lean();
        }

        updateFields.updatedAt = new Date();

        return await Plan.findOneAndUpdate(
            { _id: updateId, deletedAt: null },
            { $set: updateFields },
            { returnDocument: 'before', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listPlan = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Plan.find(query).sort({ price: 1, title: 1 }).lean();
    } catch (error) {
        throw error;
    }
};

export const listPlanPagination = async (page, limit, filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Plan.find(query)
            .sort({ price: 1, title: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
    } catch (error) {
        throw error;
    }
};

export const getPlanCount = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Plan.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

export const deletePlan = async (delId) => {
    try {
        return await Plan.findOneAndUpdate(
            { _id: delId, deletedAt: null },
            { $set: { deletedAt: new Date(), status: 'inactive' } },
            { returnDocument: 'before' }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const checkPlanTitle = async (title, excludeId = null) => {
    try {
        const query = {
            title: { $regex: `^${title}$`, $options: 'i' },
            deletedAt: null
        };
        if (excludeId) query._id = { $ne: excludeId };
        const existing = await Plan.findOne(query).select('_id').lean();
        return { isDuplicate: !!existing };
    } catch (error) {
        throw error;
    }
};
