import mongoose from 'mongoose';
import CourseAssignment from './course_assignment.model.js';

const { ObjectId } = mongoose.Types;

const buildQuery = (filters = {}) => {
    const query = {};
    if (filters.organizationId && ObjectId.isValid(filters.organizationId)) {
        query.organizationId = new ObjectId(filters.organizationId);
    }
    if (filters.userId && ObjectId.isValid(filters.userId)) {
        query.userId = new ObjectId(filters.userId);
    }
    if (filters.courseId && ObjectId.isValid(filters.courseId)) {
        query.courseId = new ObjectId(filters.courseId);
    }
    if (filters.topicId && ObjectId.isValid(filters.topicId)) {
        query.topicId = new ObjectId(filters.topicId);
    }
    if (filters.passed !== undefined) {
        query.passed = filters.passed === 'true' || filters.passed === true;
    }
    return query;
};

export const createCourseAssignment = async (data) => {
    try {
        return await new CourseAssignment({
            organizationId: data.organizationId || null,
            userId: data.userId,
            topicId: data.topicId,
            courseId: data.courseId,
            answers: data.answers || {},
            score: data.score || 0,
            passed: data.passed !== undefined ? data.passed : false,
            attemptedAt: data.attemptedAt || new Date()
        }).save();
    } catch (error) {
        throw error;
    }
};

export const editCourseAssignment = async (editId) => {
    try {
        return await CourseAssignment.findById(editId)
            .populate('organizationId', '_id name org_name')
            .populate('userId', '_id name email emp_id')
            .populate('topicId', '_id title')
            .populate('courseId', '_id title')
            .lean();
    } catch (error) {
        throw error;
    }
};

export const updateCourseAssignment = async (updateId, data) => {
    try {
        const updateFields = {};
        if (data.organizationId !== undefined) updateFields.organizationId = data.organizationId;
        if (data.userId !== undefined) updateFields.userId = data.userId;
        if (data.topicId !== undefined) updateFields.topicId = data.topicId;
        if (data.courseId !== undefined) updateFields.courseId = data.courseId;
        if (data.answers !== undefined) updateFields.answers = data.answers;
        if (data.score !== undefined) updateFields.score = data.score;
        if (data.passed !== undefined) updateFields.passed = data.passed;
        if (data.attemptedAt !== undefined) updateFields.attemptedAt = data.attemptedAt;

        if (Object.keys(updateFields).length === 0) {
            return await CourseAssignment.findById(updateId)
                .populate('organizationId', '_id name org_name')
                .populate('userId', '_id name email emp_id')
                .populate('topicId', '_id title')
                .populate('courseId', '_id title')
                .lean();
        }

        return await CourseAssignment.findByIdAndUpdate(
            updateId,
            { $set: updateFields },
            { returnDocument: 'before', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listCourseAssignment = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await CourseAssignment.find(query)
            .populate('organizationId', '_id name org_name')
            .populate('userId', '_id name email emp_id')
            .populate('topicId', '_id title')
            .populate('courseId', '_id title')
            .sort({ attemptedAt: -1 })
            .lean();
    } catch (error) {
        throw error;
    }
};

export const listCourseAssignmentPagination = async (page, limit, filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await CourseAssignment.find(query)
            .populate('organizationId', '_id name org_name')
            .populate('userId', '_id name email emp_id')
            .populate('topicId', '_id title')
            .populate('courseId', '_id title')
            .sort({ attemptedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
    } catch (error) {
        throw error;
    }
};

export const getCourseAssignmentCount = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await CourseAssignment.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

export const deleteCourseAssignment = async (delId) => {
    try {
        return await CourseAssignment.findByIdAndDelete(delId).lean();
    } catch (error) {
        throw error;
    }
};
