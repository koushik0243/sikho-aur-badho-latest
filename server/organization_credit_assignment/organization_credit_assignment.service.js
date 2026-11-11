import mongoose from 'mongoose';
import OrgCreditAssignment from './organization_credit_assignment.model.js';
import Credit from '../credits/credit.model.js';
import Organization from '../organizations/organization.model.js';
import Order from '../orders/order.model.js';
import Invoice from '../invoices/invoice.model.js';
import User from '../users/user.model.js';

const { ObjectId } = mongoose.Types;

// This router has no role gating (any authenticated user can hit it), and it's
// reachable from the StoreOwner "Purchase Credit" page in addition to the SuperAdmin
// assignment form — so a non-admin caller must only ever be able to assign credit to
// their OWN organization, never an arbitrary one passed in the request body.
async function assertCanAssignToOrg(callerId, orgId) {
    if (!callerId) return; // no caller info available — nothing to check against
    const caller = await User.findById(callerId).select('user_type orgId').lean();
    if (!caller || caller.user_type === 'superadmin') return; // admins may assign to any org
    if (String(caller.orgId || '') !== String(orgId || '')) {
        const err = new Error('You are not authorized to assign credit to this organization.');
        err.statusCode = 403;
        throw err;
    }
}

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null };
    if (filters.status) query.status = filters.status;
    if (filters.orgId && ObjectId.isValid(filters.orgId)) {
        query.orgId = new ObjectId(filters.orgId);
    }
    if (filters.creditId && ObjectId.isValid(filters.creditId)) {
        query.creditId = new ObjectId(filters.creditId);
    }
    if (filters.assignedBy && ObjectId.isValid(filters.assignedBy)) {
        query.assignedBy = new ObjectId(filters.assignedBy);
    }
    // Assigned-on (createdAt) range — ISO timestamps; either end optional, both inclusive.
    const from = filters.date_from ? new Date(filters.date_from) : null;
    const to   = filters.date_to ? new Date(filters.date_to) : null;
    if ((from && !isNaN(from)) || (to && !isNaN(to))) {
        query.createdAt = {};
        if (from && !isNaN(from)) query.createdAt.$gte = from;
        if (to && !isNaN(to)) query.createdAt.$lte = to;
    }
    return query;
};

const populateRefs = (query) =>
    query
        .populate('orgId', '_id org_name org_phone org_email')
        .populate('creditId', '_id title limit_from limit_to price')
        .populate('assignedBy', '_id name email');

export const createOrgCreditAssignment = async (data, assignedBy = null) => {
    try {
        if (!data.orgId || !ObjectId.isValid(data.orgId)) {
            const err = new Error('A valid orgId is required.');
            err.statusCode = 400;
            throw err;
        }
        if (!data.creditId || !ObjectId.isValid(data.creditId)) {
            const err = new Error('A valid creditId is required.');
            err.statusCode = 400;
            throw err;
        }
        await assertCanAssignToOrg(assignedBy, data.orgId);

        const assignment = await new OrgCreditAssignment({
            orgId:      data.orgId,
            creditId:   data.creditId,
            assignedBy: data.assignedBy || assignedBy,
            dueDate:    data.dueDate || null,
            status:     data.status || 'active',
        }).save();

        // Auto-create order + invoice for this credit assignment
        const [credit, org] = await Promise.all([
            Credit.findById(data.creditId).lean(),
            Organization.findById(data.orgId).lean(),
        ]);

        const creditAmount = credit?.price ? parseFloat(credit.price.toString()) : 0;

        const order = await new Order({
            organizer_id:    data.orgId,
            credit_id:       data.creditId,
            credit_amount:   creditAmount,
            purchase_date:   new Date(),
            payment_gateway: 'manual',
            status:          'success',
        }).save();

        await new Invoice({
            org_id:         data.orgId,
            order_id:       order._id,
            invoice_no:     `INV-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
            currency:       'INR',
            sub_total:      creditAmount,
            discount:       0,
            tax:            0,
            total_amount:   creditAmount,
            payment_status: 'paid',
            payment_method: 'manual',
            transaction_id: null,
            payment_date:   new Date(),
            bill_name:      org?.org_name   || null,
            bill_email:     org?.org_email  || null,
            bill_phone:     org?.org_phone  || null,
            bill_addr:      org?.org_address1 || org?.org_address2 || null,
            bill_city:      org?.org_city     || null,
            bill_state:     org?.org_state    || null,
            bill_country:   org?.org_country  || null,
            bill_pincode:   org?.org_zipcode  || null,
            status:         'active',
        }).save();

        return assignment;
    } catch (error) {
        throw error;
    }
};

export const editOrgCreditAssignment = async (editId) => {
    try {
        return await populateRefs(
            OrgCreditAssignment.findOne({ _id: editId, deletedAt: null })
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const updateOrgCreditAssignment = async (updateId, data) => {
    try {
        const fields = ['orgId', 'creditId', 'assignedBy', 'dueDate', 'status'];
        const updateFields = {};
        for (const field of fields) {
            if (data[field] !== undefined) updateFields[field] = data[field];
        }

        if (Object.keys(updateFields).length === 0) {
            return await populateRefs(
                OrgCreditAssignment.findOne({ _id: updateId, deletedAt: null })
            ).lean();
        }

        updateFields.updatedAt = new Date();

        return await OrgCreditAssignment.findOneAndUpdate(
            { _id: updateId, deletedAt: null },
            { $set: updateFields },
            { returnDocument: 'before', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listOrgCreditAssignment = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await populateRefs(
            OrgCreditAssignment.find(query).sort({ createdAt: -1 })
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listOrgCreditAssignmentPagination = async (page, limit, filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await populateRefs(
            OrgCreditAssignment.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const getOrgCreditAssignmentCount = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await OrgCreditAssignment.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

export const deleteOrgCreditAssignment = async (delId) => {
    try {
        return await OrgCreditAssignment.findOneAndUpdate(
            { _id: delId, deletedAt: null },
            { $set: { deletedAt: new Date(), status: 'inactive' } },
            { returnDocument: 'before' }
        ).lean();
    } catch (error) {
        throw error;
    }
};
