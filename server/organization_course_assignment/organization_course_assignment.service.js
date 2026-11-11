import mongoose from 'mongoose';
import OrgCourseAssignment from './organization_course_assignment.model.js';

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
    if (filters.assignedBy && ObjectId.isValid(filters.assignedBy)) {
        query.assignedBy = new ObjectId(filters.assignedBy);
    }
    return query;
};

const populateRefs = (query) =>
    query
        .populate('orgId', '_id name')
        .populate('courseId', '_id title slug')
        .populate('assignedBy', '_id name email');

export const createOrgCourseAssignment = async (data, assignedBy = null) => {
    try {
        return await new OrgCourseAssignment({
            orgId: data.orgId,
            courseId: data.courseId,
            assignedBy: data.assignedBy || assignedBy,
            dueDate: data.dueDate || null,
            status: data.status || 'active'
        }).save();
    } catch (error) {
        throw error;
    }
};

export const editOrgCourseAssignment = async (editId) => {
    try {
        return await populateRefs(
            OrgCourseAssignment.findOne({ _id: editId, deletedAt: null })
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const updateOrgCourseAssignment = async (updateId, data) => {
    try {
        const fields = ['orgId', 'courseId', 'assignedBy', 'dueDate', 'status'];
        const updateFields = {};
        for (const field of fields) {
            if (data[field] !== undefined) updateFields[field] = data[field];
        }

        if (Object.keys(updateFields).length === 0) {
            return await populateRefs(
                OrgCourseAssignment.findOne({ _id: updateId, deletedAt: null })
            ).lean();
        }

        updateFields.updatedAt = new Date();

        return await OrgCourseAssignment.findOneAndUpdate(
            { _id: updateId, deletedAt: null },
            { $set: updateFields },
            { returnDocument: 'before', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listOrgCourseAssignment = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await populateRefs(
            OrgCourseAssignment.find(query).sort({ createdAt: -1 })
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listOrgCourseAssignmentPagination = async (page, limit, filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await populateRefs(
            OrgCourseAssignment.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const getOrgCourseAssignmentCount = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await OrgCourseAssignment.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

export const deleteOrgCourseAssignment = async (delId) => {
    try {
        return await OrgCourseAssignment.findOneAndUpdate(
            { _id: delId, deletedAt: null },
            { $set: { deletedAt: new Date(), status: 'inactive' } },
            { returnDocument: 'before' }
        ).lean();
    } catch (error) {
        throw error;
    }
};
