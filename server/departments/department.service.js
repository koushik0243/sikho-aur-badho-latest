import slugify from 'slugify';
import Department from './department.model.js';

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
    const baseSlug = generateSlug(name) || 'department';
    let slug = baseSlug;
    let counter = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await Department.findOne(excludeId ? { slug, _id: { $ne: excludeId } } : { slug }).lean()) {
        slug = `${baseSlug}-${counter++}`;
    }
    return slug;
};

export const createDepartment = async (data) => {
    return await new Department({
        name:        data.name.trim(),
        slug:        await uniqueSlug(data.name),
        description: data.description || '',
        status:      data.status || 'active',
    }).save();
};

export const editDepartment = async (editId) => {
    return await Department.findOne({ _id: editId, deletedAt: null }).lean();
};

export const updateDepartment = async (updateId, data) => {
    const updateFields = {};
    if (data.name !== undefined) {
        updateFields.name = data.name.trim();
        updateFields.slug = await uniqueSlug(data.name, updateId);
    }
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.status !== undefined) updateFields.status = data.status;

    if (Object.keys(updateFields).length === 0) {
        return await Department.findOne({ _id: updateId, deletedAt: null }).lean();
    }
    updateFields.updatedAt = new Date();
    return await Department.findOneAndUpdate(
        { _id: updateId, deletedAt: null },
        { $set: updateFields },
        { returnDocument: 'after', runValidators: true }
    ).lean();
};

export const listDepartments = async (filters = {}) => {
    return await Department.find(buildQuery(filters)).sort({ name: 1 }).lean();
};

export const listDepartmentsPagination = async (page, limit, filters = {}) => {
    return await Department.find(buildQuery(filters))
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
};

export const getDepartmentCount = async (filters = {}) => {
    return await Department.countDocuments(buildQuery(filters));
};

// Case-insensitive exact-name lookup, used to block duplicate names.
export const checkDepartmentName = async (name, excludeId = null) => {
    const query = { name: { $regex: `^${escapeRegex(String(name || '').trim())}$`, $options: 'i' }, deletedAt: null };
    if (excludeId) query._id = { $ne: excludeId };
    return await Department.findOne(query).select('_id name').lean();
};

// Soft delete — the record stays for history, hidden from every list.
export const deleteDepartment = async (delId) => {
    return await Department.findOneAndUpdate(
        { _id: delId, deletedAt: null },
        { $set: { deletedAt: new Date(), status: 'inactive', updatedAt: new Date() } },
        { returnDocument: 'after' }
    ).lean();
};
