import mongoose from 'mongoose';
import Invoice from './invoice.model.js';

const { ObjectId } = mongoose.Types;

function generateInvoiceNo() {
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${Date.now()}-${rand}`;
}

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null };
    if (filters.status)       query.status     = filters.status;
    if (filters.payment_status) query.payment_status = filters.payment_status;
    if (filters.org_id && ObjectId.isValid(filters.org_id))
        query.org_id   = new ObjectId(filters.org_id);
    if (filters.order_id && ObjectId.isValid(filters.order_id))
        query.order_id = new ObjectId(filters.order_id);
    // Payment date range (ISO timestamps; either end optional, both inclusive).
    const from = filters.date_from ? new Date(filters.date_from) : null;
    const to   = filters.date_to ? new Date(filters.date_to) : null;
    if ((from && !isNaN(from)) || (to && !isNaN(to))) {
        query.payment_date = {};
        if (from && !isNaN(from)) query.payment_date.$gte = from;
        if (to && !isNaN(to)) query.payment_date.$lte = to;
    }
    return query;
};

const populateRefs = (q) =>
    q
        .populate('org_id', '_id org_name org_email org_phone')
        .populate({
            path: 'order_id',
            populate: { path: 'credit_id', select: '_id title price' },
        });

export const createInvoice = async (data) => {
    try {
        return await new Invoice({
            org_id:         data.org_id,
            order_id:       data.order_id,
            invoice_no:     data.invoice_no || generateInvoiceNo(),
            currency:       data.currency       || 'INR',
            sub_total:      Number(data.sub_total   ?? 0),
            discount:       Number(data.discount     ?? 0),
            tax:            Number(data.tax           ?? 0),
            total_amount:   Number(data.total_amount ?? 0),
            payment_status: data.payment_status  || 'pending',
            payment_method: data.payment_method  || null,
            transaction_id: data.transaction_id  || null,
            payment_date:   data.payment_date    || null,
            bill_name:      data.bill_name    || null,
            bill_email:     data.bill_email   || null,
            bill_phone:     data.bill_phone   || null,
            bill_addr:      data.bill_addr    || null,
            bill_city:      data.bill_city    || null,
            bill_state:     data.bill_state   || null,
            bill_country:   data.bill_country || null,
            bill_pincode:   data.bill_pincode || null,
            bill_gst_no:    data.bill_gst_no  || null,
            ship_name:      data.ship_name    || null,
            ship_email:     data.ship_email   || null,
            ship_phone:     data.ship_phone   || null,
            ship_addr:      data.ship_addr    || null,
            ship_city:      data.ship_city    || null,
            ship_state:     data.ship_state   || null,
            ship_country:   data.ship_country || null,
            ship_pincode:   data.ship_pincode || null,
            ship_gst_no:    data.ship_gst_no  || null,
            status:         data.status || 'active',
        }).save();
    } catch (error) {
        throw error;
    }
};

export const editInvoice = async (id) => {
    try {
        return await populateRefs(Invoice.findOne({ _id: id, deletedAt: null })).lean();
    } catch (error) {
        throw error;
    }
};

export const updateInvoice = async (id, data) => {
    try {
        const FIELDS = [
            'org_id', 'order_id', 'currency', 'sub_total', 'discount', 'tax',
            'total_amount', 'payment_status', 'payment_method', 'transaction_id',
            'payment_date', 'bill_name', 'bill_email', 'bill_phone', 'bill_addr',
            'bill_city', 'bill_state', 'bill_country', 'bill_pincode', 'bill_gst_no',
            'ship_name', 'ship_email', 'ship_phone', 'ship_addr', 'ship_city',
            'ship_state', 'ship_country', 'ship_pincode', 'ship_gst_no', 'status',
        ];
        const updateFields = {};
        for (const f of FIELDS) {
            if (data[f] !== undefined) updateFields[f] = data[f];
        }
        if (!Object.keys(updateFields).length)
            return await populateRefs(Invoice.findOne({ _id: id, deletedAt: null })).lean();

        updateFields.updatedAt = new Date();
        return await Invoice.findOneAndUpdate(
            { _id: id, deletedAt: null },
            { $set: updateFields },
            { returnDocument: 'after', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listInvoice = async (filters = {}) => {
    try {
        return await populateRefs(Invoice.find(buildQuery(filters)).sort({ createdAt: -1 })).lean();
    } catch (error) {
        throw error;
    }
};

export const listInvoicePagination = async (page, limit, filters = {}) => {
    try {
        return await populateRefs(
            Invoice.find(buildQuery(filters))
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const getInvoiceCount = async (filters = {}) => {
    try {
        return await Invoice.countDocuments(buildQuery(filters));
    } catch (error) {
        throw error;
    }
};

export const deleteInvoice = async (id) => {
    try {
        return await Invoice.findOneAndUpdate(
            { _id: id, deletedAt: null },
            { $set: { deletedAt: new Date(), status: 'inactive' } },
            { returnDocument: 'before' }
        ).lean();
    } catch (error) {
        throw error;
    }
};
