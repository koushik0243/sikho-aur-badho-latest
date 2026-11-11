import slugify from 'slugify';
import CourseSubCategory from './course_subcategory.model.js';

const generateSlug = (name) => slugify(name, { lower: true, strict: true, trim: true });

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null };
    if (filters.status) query.status = filters.status;
    if (filters.categoryId) query.categoryId = filters.categoryId;
    return query;
};

export const createCourseSubCategory = async (data, userId = null) => {
    try {
        const slug = generateSlug(data.name);
        return await new CourseSubCategory({
            name: data.name,
            slug,
            description: data.description,
            categoryId: data.categoryId,
            cat_subcat_image: data.cat_subcat_image || null,
            createdBy: userId,
            status: data.status || 'active'
        }).save();
    } catch (error) {
        throw error;
    }
};

export const editCourseSubCategory = async (editId) => {
    try {
        return await CourseSubCategory.findOne({ _id: editId, deletedAt: null }).populate('categoryId', 'title').lean();
    } catch (error) {
        throw error;
    }
};

export const updateCourseSubCategory = async (updateId, data) => {
    try {
        const { name, description, categoryId, status, cat_subcat_image } = data;
        const updateFields = {};

        if (name !== undefined) {
            updateFields.name = name;
            updateFields.slug = generateSlug(name);
        }
        if (description !== undefined) updateFields.description = description;
        if (categoryId !== undefined) updateFields.categoryId = categoryId;
        if (status !== undefined) updateFields.status = status;
        if (cat_subcat_image !== undefined) updateFields.cat_subcat_image = cat_subcat_image;

        if (Object.keys(updateFields).length === 0) {
            return await CourseSubCategory.findOne({ _id: updateId, deletedAt: null }).lean();
        }

        updateFields.updatedAt = new Date();

        return await CourseSubCategory.findOneAndUpdate(
            { _id: updateId, deletedAt: null },
            { $set: updateFields },
            { returnDocument: 'before', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listCourseSubCategory = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await CourseSubCategory.find(query).populate('categoryId', 'title').sort({ name: 1 }).lean();
    } catch (error) {
        throw error;
    }
};

export const listCourseSubCategoryPagination = async (page, limit, filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await CourseSubCategory.find(query)
            .populate('categoryId', 'title')
            .sort({ name: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
    } catch (error) {
        throw error;
    }
};

export const getCourseSubCategoryCount = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await CourseSubCategory.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

export const deleteCourseSubCategory = async (delId) => {
    try {
        return await CourseSubCategory.findOneAndUpdate(
            { _id: delId, deletedAt: null },
            { $set: { deletedAt: new Date(), status: 'inactive' } },
            { returnDocument: 'before' }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const checkCourseSubCategoryName = async (name, excludeId = null) => {
    try {
        const query = { name: { $regex: `^${name}$`, $options: 'i' }, deletedAt: null };
        if (excludeId) query._id = { $ne: excludeId };
        const existing = await CourseSubCategory.findOne(query).lean();
        return { isDuplicate: !!existing };
    } catch (error) {
        throw error;
    }
};
