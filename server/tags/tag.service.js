import slugify from 'slugify';
import Tag from './tag.model.js';

const generateSlug = (title) => slugify(title, { lower: true, strict: true, trim: true });

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null };
    if (filters.status) query.status = filters.status;
    return query;
};

export const createTag = async (data, userId = null) => {
    try {
        const baseSlug = generateSlug(data.title);
        let slug = baseSlug;
        let counter = 1;
        while (await Tag.findOne({ slug }).lean()) {
            slug = `${baseSlug}-${counter++}`;
        }
        return await new Tag({
            title: data.title,
            slug,
            desc: data.desc || '',
            createdBy: userId,
            status: data.status || 'active'
        }).save();
    } catch (error) {
        throw error;
    }
};

export const getTag = async (id) => {
    try {
        return await Tag.findOne({ _id: id, deletedAt: null }).lean();
    } catch (error) {
        throw error;
    }
};

export const updateTag = async (id, data) => {
    try {
        const updateFields = {};
        if (data.title !== undefined) {
            updateFields.title = data.title;
            updateFields.slug = generateSlug(data.title);
        }
        if (data.desc !== undefined) updateFields.desc = data.desc;
        if (data.status !== undefined) updateFields.status = data.status;
        updateFields.updatedAt = new Date();

        return await Tag.findOneAndUpdate(
            { _id: id, deletedAt: null },
            { $set: updateFields },
            { returnDocument: 'after', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listTags = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Tag.find(query).sort({ title: 1 }).lean();
    } catch (error) {
        throw error;
    }
};

export const listTagsPagination = async (page, limit, filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Tag.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
    } catch (error) {
        throw error;
    }
};

export const getTagCount = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Tag.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

export const deleteTag = async (id) => {
    try {
        return await Tag.findOneAndUpdate(
            { _id: id, deletedAt: null },
            { $set: { deletedAt: new Date() } },
            { returnDocument: 'after' }
        ).lean();
    } catch (error) {
        throw error;
    }
};
