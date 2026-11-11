import mongoose from 'mongoose';
import slugify from 'slugify';
import Credit from './credit.model.js';

const generateSlug = (title) => slugify(title, { lower: true, strict: true, trim: true });

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null };
    if (filters.status) query.status = filters.status;
    return query;
};

export const createCredit = async (data, userId = null) => {
    try {
        const slug = generateSlug(data.title);
        return await new Credit({
            title: data.title,
            slug,
            limit_from: Number(data.limit_from),
            limit_to: Number(data.limit_to),
            price: mongoose.Types.Decimal128.fromString(String(data.price ?? '0.00')),
            desc: data.desc || null,
            createdBy: userId,
            status: data.status || 'active'
        }).save();
    } catch (error) {
        throw error;
    }
};

export const editCredit = async (editId) => {
    try {
        return await Credit.findOne({ _id: editId, deletedAt: null })
            .populate('createdBy', '_id name email')
            .lean();
    } catch (error) {
        throw error;
    }
};

export const updateCredit = async (updateId, data) => {
    try {
        const numericFields = ['limit_from', 'limit_to'];
        const scalarFields = ['desc', 'status'];
        const updateFields = {};

        if (data.title !== undefined) {
            updateFields.title = data.title;
            updateFields.slug = generateSlug(data.title);
        }
        for (const field of numericFields) {
            if (data[field] !== undefined) updateFields[field] = Number(data[field]);
        }
        for (const field of scalarFields) {
            if (data[field] !== undefined) updateFields[field] = data[field];
        }
        if (data.price !== undefined) {
            updateFields.price = mongoose.Types.Decimal128.fromString(String(data.price));
        }

        if (Object.keys(updateFields).length === 0) {
            return await Credit.findOne({ _id: updateId, deletedAt: null }).lean();
        }

        updateFields.updatedAt = new Date();

        return await Credit.findOneAndUpdate(
            { _id: updateId, deletedAt: null },
            { $set: updateFields },
            { returnDocument: 'before', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listCredit = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Credit.find(query)
            .populate('createdBy', '_id name email')
            .sort({ limit_to: 1 })
            .lean();
    } catch (error) {
        throw error;
    }
};

export const listCreditPagination = async (page, limit, filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Credit.find(query)
            .populate('createdBy', '_id name email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
    } catch (error) {
        throw error;
    }
};

export const getCreditCount = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Credit.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

export const deleteCredit = async (delId) => {
    try {
        return await Credit.findOneAndUpdate(
            { _id: delId, deletedAt: null },
            { $set: { deletedAt: new Date(), status: 'inactive' } },
            { returnDocument: 'before' }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const checkCreditTitle = async (title, excludeId = null) => {
    try {
        const query = { title: { $regex: `^${title}$`, $options: 'i' }, deletedAt: null };
        if (excludeId) query._id = { $ne: excludeId };
        const existing = await Credit.findOne(query).select('_id').lean();
        return { isDuplicate: !!existing };
    } catch (error) {
        throw error;
    }
};
