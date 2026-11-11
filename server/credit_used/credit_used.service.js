import mongoose from 'mongoose';
import CreditUsed from './credit_used.model.js';

const { ObjectId } = mongoose.Types;

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null };
    if (filters.orgId && ObjectId.isValid(filters.orgId)) {
        query.orgId = new ObjectId(filters.orgId);
    }
    if (filters.learnerId && ObjectId.isValid(filters.learnerId)) {
        query.learnerId = new ObjectId(filters.learnerId);
    }
    if (filters.courseId && ObjectId.isValid(filters.courseId)) {
        query.courseId = new ObjectId(filters.courseId);
    }
    if (filters.status) {
        query.status = filters.status;
    }
    return query;
};

const populateRefs = (q) =>
    q.populate('orgId',     '_id name')
     .populate('learnerId', '_id name email')
     .populate('courseId',  '_id title');

export const createCreditUsed = async (data) => {
    return await new CreditUsed({
        orgId:     data.orgId,
        learnerId: data.learnerId,
        courseId:  data.courseId || null,
        status:    data.status   || 'active',
    }).save();
};

export const editCreditUsed = async (id) => {
    return await populateRefs(CreditUsed.findById(id)).lean();
};

export const updateCreditUsed = async (id, data) => {
    const fields = {};
    if (data.orgId     !== undefined) fields.orgId     = data.orgId;
    if (data.learnerId !== undefined) fields.learnerId = data.learnerId;
    if (data.courseId  !== undefined) fields.courseId  = data.courseId;
    if (data.status    !== undefined) fields.status    = data.status;
    if (data.deletedAt !== undefined) fields.deletedAt = data.deletedAt;

    if (Object.keys(fields).length === 0) {
        return await populateRefs(CreditUsed.findById(id)).lean();
    }
    return await CreditUsed.findByIdAndUpdate(id, { $set: fields }, { returnDocument: 'after' }).lean();
};

export const listCreditUsed = async (filters = {}) => {
    const query = buildQuery(filters);
    return await populateRefs(CreditUsed.find(query).sort({ createdAt: -1 })).lean();
};

export const listCreditUsedPagination = async (page, limit, filters = {}) => {
    const query = buildQuery(filters);
    return await populateRefs(
        CreditUsed.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
    ).lean();
};

export const getCreditUsedCount = async (filters = {}) => {
    const query = buildQuery(filters);
    return await CreditUsed.countDocuments(query);
};

export const deleteCreditUsed = async (id) => {
    return await CreditUsed.findByIdAndUpdate(
        id,
        { $set: { deletedAt: new Date(), status: 'inactive' } },
        { returnDocument: 'after' }
    ).lean();
};
