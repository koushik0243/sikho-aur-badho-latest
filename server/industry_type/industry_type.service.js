import slugify from 'slugify';
import IndustryType from './industry_type.model.js';

const generateSlug = (name) => slugify(name, { lower: true, strict: true, trim: true });

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null };
    if (filters.status) query.status = filters.status;
    if (filters.search) query.name = { $regex: filters.search, $options: 'i' };
    return query;
};

export const createIndustryType = async (data) => {
    try {
        const baseSlug = generateSlug(data.name);
        let slug = baseSlug;
        let counter = 1;
        while (await IndustryType.findOne({ slug }).lean()) {
            slug = `${baseSlug}-${counter++}`;
        }
        return await new IndustryType({
            name:        data.name,
            slug,
            description: data.description || '',
            parentId:    data.parentId || null,
            status:      data.status || 'active',
        }).save();
    } catch (error) {
        throw error;
    }
};

export const editIndustryType = async (editId) => {
    try {
        return await IndustryType.findOne({ _id: editId, deletedAt: null }).lean();
    } catch (error) {
        throw error;
    }
};

export const updateIndustryType = async (updateId, data) => {
    try {
        const updateFields = {};
        if (data.name !== undefined) {
            updateFields.name = data.name;
            updateFields.slug = generateSlug(data.name);
        }
        if (data.description !== undefined) updateFields.description = data.description;
        if ('parentId' in data) updateFields.parentId = data.parentId || null;
        if (data.status !== undefined) updateFields.status = data.status;

        if (Object.keys(updateFields).length === 0) {
            return await IndustryType.findOne({ _id: updateId, deletedAt: null }).lean();
        }
        updateFields.updatedAt = new Date();
        return await IndustryType.findOneAndUpdate(
            { _id: updateId, deletedAt: null },
            { $set: updateFields },
            { returnDocument: 'after', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listAllIndustryTypes = async () => {
    try {
        return await IndustryType.find({ deletedAt: null }).sort({ name: 1 }).lean();
    } catch (error) {
        throw error;
    }
};

export const listIndustryTypes = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await IndustryType.find(query).sort({ name: 1 }).lean();
    } catch (error) {
        throw error;
    }
};

export const listIndustryTypesPagination = async (page, limit, filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await IndustryType.find(query).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean();
    } catch (error) {
        throw error;
    }
};

export const getIndustryTypeCount = async (filters = {}) => {
    try {
        return await IndustryType.countDocuments(buildQuery(filters));
    } catch (error) {
        throw error;
    }
};

export const checkIndustryTypeName = async (name, excludeId = null) => {
    try {
        const query = { name: { $regex: `^${name}$`, $options: 'i' }, deletedAt: null };
        if (excludeId) query._id = { $ne: excludeId };
        return await IndustryType.findOne(query).select('_id name').lean();
    } catch (error) {
        throw error;
    }
};

export const deleteIndustryTypeTree = async (rootId) => {
    try {
        const all = await IndustryType.find({ deletedAt: null }).select('_id parentId').lean();
        const childMap = {};
        all.forEach(n => {
            const pid = n.parentId ? String(n.parentId) : null;
            if (pid) {
                if (!childMap[pid]) childMap[pid] = [];
                childMap[pid].push(String(n._id));
            }
        });
        const toDelete = [];
        const queue = [String(rootId)];
        while (queue.length) {
            const id = queue.shift();
            toDelete.push(id);
            (childMap[id] || []).forEach(c => queue.push(c));
        }
        await IndustryType.updateMany(
            { _id: { $in: toDelete }, deletedAt: null },
            { $set: { deletedAt: new Date(), status: 'inactive' } }
        );
        return { deleted: toDelete.length };
    } catch (error) {
        throw error;
    }
};
