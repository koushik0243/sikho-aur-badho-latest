import slugify from 'slugify';
import Designation from './designation.model.js';

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
    const baseSlug = generateSlug(name) || 'designation';
    let slug = baseSlug;
    let counter = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await Designation.findOne(excludeId ? { slug, _id: { $ne: excludeId } } : { slug }).lean()) {
        slug = `${baseSlug}-${counter++}`;
    }
    return slug;
};

export const createDesignation = async (data) => {
    return await new Designation({
        name:        data.name.trim(),
        slug:        await uniqueSlug(data.name),
        description: data.description || '',
        status:      data.status || 'active',
    }).save();
};

export const editDesignation = async (editId) => {
    return await Designation.findOne({ _id: editId, deletedAt: null }).lean();
};

export const updateDesignation = async (updateId, data) => {
    const updateFields = {};
    if (data.name !== undefined) {
        updateFields.name = data.name.trim();
        updateFields.slug = await uniqueSlug(data.name, updateId);
    }
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.status !== undefined) updateFields.status = data.status;

    if (Object.keys(updateFields).length === 0) {
        return await Designation.findOne({ _id: updateId, deletedAt: null }).lean();
    }
    updateFields.updatedAt = new Date();
    return await Designation.findOneAndUpdate(
        { _id: updateId, deletedAt: null },
        { $set: updateFields },
        { returnDocument: 'after', runValidators: true }
    ).lean();
};

export const listDesignations = async (filters = {}) => {
    return await Designation.find(buildQuery(filters)).sort({ name: 1 }).lean();
};

export const listDesignationsPagination = async (page, limit, filters = {}) => {
    return await Designation.find(buildQuery(filters))
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
};

export const getDesignationCount = async (filters = {}) => {
    return await Designation.countDocuments(buildQuery(filters));
};

// Case-insensitive exact-name lookup, used to block duplicate names.
export const checkDesignationName = async (name, excludeId = null) => {
    const query = { name: { $regex: `^${escapeRegex(String(name || '').trim())}$`, $options: 'i' }, deletedAt: null };
    if (excludeId) query._id = { $ne: excludeId };
    return await Designation.findOne(query).select('_id name').lean();
};

// Soft delete — the record stays for history, hidden from every list.
export const deleteDesignation = async (delId) => {
    return await Designation.findOneAndUpdate(
        { _id: delId, deletedAt: null },
        { $set: { deletedAt: new Date(), status: 'inactive', updatedAt: new Date() } },
        { returnDocument: 'after' }
    ).lean();
};
