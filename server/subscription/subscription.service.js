import mongoose from 'mongoose';
import Subscription from './subscription.model.js';

const { ObjectId } = mongoose.Types;

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null };
    if (filters.status) query.status = filters.status;
    if (filters.organizationId && ObjectId.isValid(filters.organizationId)) {
        query.organizationId = new ObjectId(filters.organizationId);
    }
    if (filters.planId && ObjectId.isValid(filters.planId)) {
        query.planId = new ObjectId(filters.planId);
    }
    return query;
};

export const createSubscription = async (data) => {
    try {
        return await new Subscription({
            organizationId: data.organizationId,
            planId: data.planId,
            status: data.status || 'trialing',
            startDate: data.startDate || Date.now(),
            endDate: data.endDate || null,
            trialEndDate: data.trialEndDate || null,
            autoRenew: data.autoRenew !== undefined ? data.autoRenew : true,
            currentPeriodStart: data.currentPeriodStart || null,
            currentPeriodEnd: data.currentPeriodEnd || null,
            cancelAt: data.cancelAt || null,
            canceledAt: data.canceledAt || null,
            paymentProvider: data.paymentProvider || null
        }).save();
    } catch (error) {
        throw error;
    }
};

export const editSubscription = async (editId) => {
    try {
        return await Subscription.findOne({ _id: editId, deletedAt: null })
            .populate('organizationId', '_id org_name')
            .populate('planId', '_id title price billingCycle maxUsers')
            .lean();
    } catch (error) {
        throw error;
    }
};

export const updateSubscription = async (updateId, data) => {
    try {
        const fields = [
            'planId', 'status', 'startDate', 'endDate', 'trialEndDate',
            'autoRenew', 'currentPeriodStart', 'currentPeriodEnd',
            'cancelAt', 'canceledAt', 'paymentProvider'
        ];
        const updateFields = {};
        for (const field of fields) {
            if (data[field] !== undefined) updateFields[field] = data[field];
        }

        if (Object.keys(updateFields).length === 0) {
            return await Subscription.findOne({ _id: updateId, deletedAt: null }).lean();
        }

        updateFields.updatedAt = new Date();

        return await Subscription.findOneAndUpdate(
            { _id: updateId, deletedAt: null },
            { $set: updateFields },
            { returnDocument: 'before', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listSubscription = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Subscription.find(query)
            .populate('organizationId', '_id org_name')
            .populate('planId', '_id title price billingCycle maxUsers')
            .sort({ createdAt: -1 })
            .lean();
    } catch (error) {
        throw error;
    }
};

export const listSubscriptionPagination = async (page, limit, filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Subscription.find(query)
            .populate('organizationId', '_id org_name')
            .populate('planId', '_id title price billingCycle maxUsers')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
    } catch (error) {
        throw error;
    }
};

export const getSubscriptionCount = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Subscription.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

export const deleteSubscription = async (delId) => {
    try {
        return await Subscription.findOneAndUpdate(
            { _id: delId, deletedAt: null },
            { $set: { deletedAt: new Date(), status: 'inactive' } },
            { returnDocument: 'before' }
        ).lean();
    } catch (error) {
        throw error;
    }
};
