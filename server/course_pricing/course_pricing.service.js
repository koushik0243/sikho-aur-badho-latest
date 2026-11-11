import mongoose from 'mongoose';
import CoursePricing from './course_pricing.model.js';

const { ObjectId } = mongoose.Types;

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null };
    if (filters.status) query.status = filters.status;
    if (filters.courseId && ObjectId.isValid(filters.courseId)) {
        query.courseId = new ObjectId(filters.courseId);
    }
    return query;
};

const populateRefs = (query) =>
    query.populate('courseId', '_id title').lean();

export const createCoursePricing = async (data) => {
    return await new CoursePricing({
        courseId:  data.courseId,
        quantity:  data.quantity  ?? 1,
        mrp_price: data.mrp_price ?? 0,
        price:     data.price     ?? 0,
        isDefault: data.isDefault ?? false,
        status:    data.status    || 'active',
    }).save();
};

export const editCoursePricing = async (id) => {
    return await populateRefs(
        CoursePricing.findOne({ _id: id, deletedAt: null })
    );
};

export const updateCoursePricing = async (id, data) => {
    const updateFields = {};
    if (data.quantity  !== undefined) updateFields.quantity  = data.quantity;
    if (data.mrp_price !== undefined) updateFields.mrp_price = data.mrp_price;
    if (data.price     !== undefined) updateFields.price     = data.price;
    if (data.isDefault !== undefined) updateFields.isDefault = data.isDefault;
    if (data.status    !== undefined) updateFields.status    = data.status;
    updateFields.updatedAt = new Date();

    return await CoursePricing.findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: updateFields },
        { returnDocument: 'after', runValidators: true }
    ).lean();
};

export const deleteCoursePricing = async (id) => {
    return await CoursePricing.findOneAndUpdate(
        { _id: id },
        { $set: { deletedAt: new Date() } },
        { returnDocument: 'after' }
    ).lean();
};

export const listCoursePricing = async (filters = {}) => {
    const query = buildQuery(filters);
    return await populateRefs(
        CoursePricing.find(query).sort({ isDefault: -1, quantity: 1 })
    );
};

export const listCoursePricingPagination = async (page, limit, filters = {}) => {
    const query = buildQuery(filters);
    return await populateRefs(
        CoursePricing.find(query)
            .sort({ isDefault: -1, quantity: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
    );
};

export const getCoursePricingCount = async (filters = {}) => {
    const query = buildQuery(filters);
    return await CoursePricing.countDocuments(query);
};
