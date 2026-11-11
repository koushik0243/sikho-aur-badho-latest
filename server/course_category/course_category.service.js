import slugify from 'slugify';
import CourseCategory from './course_category.model.js';

const generateSlug = (title) => slugify(title, { lower: true, strict: true, trim: true });

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null };
    if (filters.status) query.status = filters.status;
    return query;
};

export const createCourseCategory = async (data, userId = null) => {
    try {
        const baseSlug = generateSlug(data.title);
        let slug = baseSlug;
        let counter = 1;
        while (await CourseCategory.findOne({ slug }).lean()) {
            slug = `${baseSlug}-${counter++}`;
        }
        return await new CourseCategory({
            title: data.title,
            slug,
            desc: data.desc || '',
            parentId: data.parentId || null,
            cat_subcat_image: data.cat_subcat_image || null,
            totalCourses: data.totalCourses || 0,
            createdBy: userId,
            status: data.status || 'active'
        }).save();
    } catch (error) {
        throw error;
    }
};

export const editCourseCategory = async (editId) => {
    try {
        return await CourseCategory.findOne({ _id: editId, deletedAt: null }).lean();
    } catch (error) {
        throw error;
    }
};

export const updateCourseCategory = async (updateId, data) => {
    try {
        const { title, desc, cat_subcat_image, totalCourses, status } = data;
        const updateFields = {};

        if (title !== undefined) {
            updateFields.title = title;
            updateFields.slug = generateSlug(title);
        }
        if (desc !== undefined) updateFields.desc = desc;
        if (cat_subcat_image !== undefined) updateFields.cat_subcat_image = cat_subcat_image;
        if (totalCourses !== undefined) updateFields.totalCourses = totalCourses;
        if (status !== undefined) updateFields.status = status;
        if ('parentId' in data) updateFields.parentId = data.parentId || null;

        if (Object.keys(updateFields).length === 0) {
            return await CourseCategory.findOne({ _id: updateId, deletedAt: null }).lean();
        }

        updateFields.updatedAt = new Date();

        return await CourseCategory.findOneAndUpdate(
            { _id: updateId, deletedAt: null },
            { $set: updateFields },
            { returnDocument: 'after', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listCourseCategory = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await CourseCategory.find(query).sort({ title: 1 }).lean();
    } catch (error) {
        throw error;
    }
};

export const listCourseCategoryPagination = async (page, limit, filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await CourseCategory.find(query)
            .sort({ title: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
    } catch (error) {
        throw error;
    }
};

export const getCourseCategoryCount = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await CourseCategory.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

export const deleteCourseCategory = async (delId) => {
    try {
        return await CourseCategory.findOneAndUpdate(
            { _id: delId, deletedAt: null },
            { $set: { deletedAt: new Date(), status: 'inactive' } },
            { returnDocument: 'before' }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const checkCourseCategoryTitle = async (title, excludeId = null) => {
    try {
        const query = { title: { $regex: `^${title}$`, $options: 'i' }, deletedAt: null };
        if (excludeId) query._id = { $ne: excludeId };
        const existing = await CourseCategory.findOne(query).lean();
        return { isDuplicate: !!existing };
    } catch (error) {
        throw error;
    }
};

export const listAllCategories = async () => {
    try {
        return await CourseCategory.find({ deletedAt: null })
            .sort({ title: 1 })
            .lean();
    } catch (error) {
        throw error;
    }
};

export const deleteCategoryTree = async (rootId) => {
    // Soft-delete a node and all its descendants recursively
    try {
        const all = await CourseCategory.find({ deletedAt: null }).lean();
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
        await CourseCategory.updateMany(
            { _id: { $in: toDelete }, deletedAt: null },
            { $set: { deletedAt: new Date(), status: 'inactive' } }
        );
        return { deleted: toDelete.length };
    } catch (error) {
        throw error;
    }
};
