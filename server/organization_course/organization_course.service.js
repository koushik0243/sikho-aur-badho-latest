import mongoose from 'mongoose';
import OrganizationCourse from './organization_course.model.js';

const { ObjectId } = mongoose.Types;

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null };
    if (filters.status) query.status = filters.status;
    if (filters.orgId && ObjectId.isValid(filters.orgId)) {
        query.orgId = new ObjectId(filters.orgId);
    }
    if (filters.courseId && ObjectId.isValid(filters.courseId)) {
        query.courseId = new ObjectId(filters.courseId);
    }
    if (filters.coursePriceId && ObjectId.isValid(filters.coursePriceId)) {
        query.coursePriceId = new ObjectId(filters.coursePriceId);
    }
    return query;
};

const populateRefs = (query) =>
    query
        .populate('orgId', '_id org_name')
        .populate('courseId', '_id title slug status')
        .populate('coursePriceId', '_id price mrp_price quantity');

export const createOrganizationCourse = async (data) => {
    try {
        return await new OrganizationCourse({
            orgId: data.orgId,
            courseId: data.courseId,
            coursePriceId: data.coursePriceId || null,
            startDate: data.startDate || null,
            endDate: data.endDate || null,
            status: data.status || 'active'
        }).save();
    } catch (error) {
        throw error;
    }
};

export const editOrganizationCourse = async (editId) => {
    try {
        return await populateRefs(
            OrganizationCourse.findOne({ _id: editId, deletedAt: null })
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const updateOrganizationCourse = async (updateId, data) => {
    try {
        const fields = ['orgId', 'courseId', 'coursePriceId', 'startDate', 'endDate', 'status'];
        const updateFields = {};
        for (const field of fields) {
            if (data[field] !== undefined) updateFields[field] = data[field];
        }

        if (Object.keys(updateFields).length === 0) {
            return await populateRefs(
                OrganizationCourse.findOne({ _id: updateId, deletedAt: null })
            ).lean();
        }

        updateFields.updatedAt = new Date();

        return await OrganizationCourse.findOneAndUpdate(
            { _id: updateId, deletedAt: null },
            { $set: updateFields },
            { returnDocument: 'before', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listOrganizationCourse = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await populateRefs(
            OrganizationCourse.find(query).sort({ createdAt: -1 })
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listOrganizationCoursePagination = async (page, limit, filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await populateRefs(
            OrganizationCourse.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const getOrganizationCourseCount = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await OrganizationCourse.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

export const deleteOrganizationCourse = async (delId) => {
    try {
        return await OrganizationCourse.findOneAndUpdate(
            { _id: delId, deletedAt: null },
            { $set: { deletedAt: new Date(), status: 'inactive' } },
            { returnDocument: 'before' }
        ).lean();
    } catch (error) {
        throw error;
    }
};
