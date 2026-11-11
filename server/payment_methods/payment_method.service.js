import slugify from 'slugify';
import PaymentMethod from './payment_method.model.js';

const generateSlug = (name) => slugify(name, { lower: true, strict: true, trim: true });

// Escape user text before using it inside a RegExp.
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null };
    if (filters.status) query.status = filters.status;
    if (filters.search) query.name = { $regex: escapeRegex(filters.search), $options: 'i' };
    return query;
};

const uniqueSlug = async (name, excludeId = null) => {
    const baseSlug = generateSlug(name) || 'payment-method';
    let slug = baseSlug;
    let counter = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await PaymentMethod.findOne(excludeId ? { slug, _id: { $ne: excludeId } } : { slug }).lean()) {
        slug = `${baseSlug}-${counter++}`;
    }
    return slug;
};

export const createPaymentMethod = async (data) => {
    return await new PaymentMethod({
        name:        data.name.trim(),
        slug:        await uniqueSlug(data.name),
        description: data.description || '',
        status:      data.status || 'active',
    }).save();
};

export const editPaymentMethod = async (editId) => {
    return await PaymentMethod.findOne({ _id: editId, deletedAt: null }).lean();
};

export const updatePaymentMethod = async (updateId, data) => {
    const updateFields = {};
    // The slug is the code stored on invoices — kept as created, even on rename.
    if (data.name !== undefined) updateFields.name = data.name.trim();
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.status !== undefined) updateFields.status = data.status;

    if (Object.keys(updateFields).length === 0) {
        return await PaymentMethod.findOne({ _id: updateId, deletedAt: null }).lean();
    }
    updateFields.updatedAt = new Date();
    return await PaymentMethod.findOneAndUpdate(
        { _id: updateId, deletedAt: null },
        { $set: updateFields },
        { returnDocument: 'after', runValidators: true }
    ).lean();
};

export const listPaymentMethods = async (filters = {}) => {
    return await PaymentMethod.find(buildQuery(filters)).sort({ name: 1 }).lean();
};

export const listPaymentMethodsPagination = async (page, limit, filters = {}) => {
    return await PaymentMethod.find(buildQuery(filters))
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
};

export const getPaymentMethodCount = async (filters = {}) => {
    return await PaymentMethod.countDocuments(buildQuery(filters));
};

// Case-insensitive exact-name lookup, used to block duplicate names.
export const checkPaymentMethodName = async (name, excludeId = null) => {
    const query = { name: { $regex: `^${escapeRegex(String(name || '').trim())}$`, $options: 'i' }, deletedAt: null };
    if (excludeId) query._id = { $ne: excludeId };
    return await PaymentMethod.findOne(query).select('_id name').lean();
};

// Soft delete — the record stays for history, hidden from every list.
export const deletePaymentMethod = async (delId) => {
    return await PaymentMethod.findOneAndUpdate(
        { _id: delId, deletedAt: null },
        { $set: { deletedAt: new Date(), status: 'inactive', updatedAt: new Date() } },
        { returnDocument: 'after' }
    ).lean();
};

// The (not deleted) payment method with this slug — used to validate the
// payment method stored on an invoice.
export const findPaymentMethodBySlug = async (slug) => {
    if (!slug) return null;
    return await PaymentMethod.findOne({ slug: String(slug).trim().toLowerCase(), deletedAt: null }).select('_id name slug status').lean();
};
