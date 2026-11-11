import mongoose from 'mongoose';
import Topic from './topic.model.js';
import { CLEARED_LESSON_VIDEO, deleteVideoFiles } from '../_helpers/deleteVideoFiles.js';

const { ObjectId } = mongoose.Types;

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null };
    if (filters.status) query.status = filters.status;
    if (filters.courseId && ObjectId.isValid(filters.courseId)) {
        query.courseId = new ObjectId(filters.courseId);
    }
    if (filters.chapterId && ObjectId.isValid(filters.chapterId)) {
        query.chapterId = new ObjectId(filters.chapterId);
    }
    return query;
};

// "How many videos can upload?" on an assignment: a whole number from 1 to 50.
const MAX_VIDEOS_LIMIT = 50;
function cleanMaxVideos(value) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > MAX_VIDEOS_LIMIT) {
        const err = new Error(`"How many videos can upload?" must be a whole number from 1 to ${MAX_VIDEOS_LIMIT}.`);
        err.statusCode = 400;
        throw err;
    }
    return n;
}

export const createTopic = async (data) => {
    try {
        return await new Topic({
            courseId: data.courseId,
            chapterId: data.chapterId,
            title: data.title,
            desc: data.desc || '',
            video_type: data.video_type || 'file',
            imageUrl: data.imageUrl || null,
            videoUrl: data.videoUrl || null,
            videoStatus: data.videoStatus || null, // set by the controller, never from the request
            duration_hr: data.duration_hr || '0',
            duration_min: data.duration_min || '0',
            attachments: data.attachments || [],
            maxVideos: data.video_type === 'assignment' ? (cleanMaxVideos(data.maxVideos) ?? null) : null,
            quizSettings: data.quizSettings || null,
            order: data.order,
            isPreview: data.isPreview !== undefined ? data.isPreview : false,
            isPublished: data.isPublished !== undefined ? data.isPublished : true,
            status: data.status || 'active'
        }).save();
    } catch (error) {
        throw error;
    }
};

export const editTopic = async (editId) => {
    try {
        return await Topic.findOne({ _id: editId, deletedAt: null }).lean();
    } catch (error) {
        throw error;
    }
};

export const updateTopic = async (updateId, data) => {
    try {
        const fields = [
            'courseId', 'chapterId', 'title', 'desc', 'video_type',
            'imageUrl', 'videoUrl', 'duration_hr', 'duration_min', 'attachments',
            'quizSettings', 'order', 'isPreview', 'isPublished', 'status', 'maxVideos',
            'videoStatus' // set by the controller, never from the request
        ];
        if (data.maxVideos !== undefined) data = { ...data, maxVideos: cleanMaxVideos(data.maxVideos) };
        const updateFields = {};
        for (const field of fields) {
            if (data[field] !== undefined) updateFields[field] = data[field];
        }

        if (Object.keys(updateFields).length === 0) {
            return await Topic.findOne({ _id: updateId, deletedAt: null }).lean();
        }

        updateFields.updatedAt = new Date();

        return await Topic.findOneAndUpdate(
            { _id: updateId, deletedAt: null },
            { $set: updateFields },
            // the saved lesson — the builder reads the new video/image path from it
            { returnDocument: 'after', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listTopic = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Topic.find(query).sort({ order: 1, title: 1 }).lean();
    } catch (error) {
        throw error;
    }
};

export const listTopicPagination = async (page, limit, filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Topic.find(query)
            .sort({ order: 1, title: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
    } catch (error) {
        throw error;
    }
};

export const getTopicCount = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Topic.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

// Deleting a lesson also removes its uploaded video file (_helpers/deleteVideoFiles.js).
export const deleteTopic = async (delId) => {
    try {
        const deleted = await Topic.findOneAndUpdate(
            { _id: delId, deletedAt: null },
            { $set: { deletedAt: new Date(), status: 'inactive', ...CLEARED_LESSON_VIDEO } },
            { returnDocument: 'before' }
        ).lean();
        if (deleted) await deleteVideoFiles([deleted.videoUrl]);
        return deleted;
    } catch (error) {
        throw error;
    }
};

export const checkTopicTitle = async (title, courseId, chapterId, excludeId = null) => {
    try {
        const query = {
            title: { $regex: `^${title}$`, $options: 'i' },
            courseId,
            chapterId,
            deletedAt: null
        };
        if (excludeId) query._id = { $ne: excludeId };
        const existing = await Topic.findOne(query).lean();
        return { isDuplicate: !!existing };
    } catch (error) {
        throw error;
    }
};
