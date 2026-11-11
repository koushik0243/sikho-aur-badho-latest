import mongoose from 'mongoose';
import slugify from 'slugify';
import Course from './course.model.js';
import Chapter from '../chapters/chapter.model.js';
import Topic from '../topics/topic.model.js';
import { CLEARED_INTRO_VIDEO, deleteLessonsWithVideos, deleteVideoFiles } from '../_helpers/deleteVideoFiles.js';

// Aptitude test settings (course builder → Aptitude Test → Settings). Only
// these keys are kept; values are normalised to the builder's form types.
// (Attempts / pass mark / max questions don't apply to the aptitude test.)
const APTITUDE_SETTING_RULES = {
    timeLimit:          v => String(Math.max(0, parseInt(v, 10) || 0)),
    timeUnit:           v => (['Seconds', 'Minutes', 'Hours'].includes(v) ? v : 'Minutes'),
    hideQuizTime:       v => v === true || v === 'true',
    quizAutoStart:      v => v === true || v === 'true',
    questionLayout:     v => (v === 'all' ? 'all' : 'single'),
    questionOrder:      v => (v === 'random' ? 'random' : 'sequential'),
    hideQuestionNumber: v => v === true || v === 'true',
};
export const sanitizeAptitudeSettings = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const out = {};
    for (const [key, rule] of Object.entries(APTITUDE_SETTING_RULES)) {
        if (raw[key] !== undefined) out[key] = rule(raw[key]);
    }
    return Object.keys(out).length ? out : null;
};

const { ObjectId } = mongoose.Types;

const generateSlug = (title) => slugify(title, { lower: true, strict: true, trim: true });

/**
 * Category fields to store: catIds = all selected categories, catId = the first
 * (or null). Older clients send only catId, which becomes a one-item catIds.
 * Returns {} when the request carries no category data (leave them unchanged).
 */
const categoryFields = (data) => {
    if (Array.isArray(data.catIds)) {
        const catIds = data.catIds.filter(id => ObjectId.isValid(id));
        return { catIds, catId: catIds[0] || null };
    }
    if (data.catId !== undefined) {
        const catId = data.catId && ObjectId.isValid(data.catId) ? data.catId : null;
        return { catId, catIds: catId ? [catId] : [] };
    }
    return {};
};

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null, status: { $ne: 'deleted' } };
    if (filters.status) query.status = filters.status;
    if (filters.catId && ObjectId.isValid(filters.catId)) {
        query.catId = new ObjectId(filters.catId);
    }
    if (filters.level) query.level = filters.level;
    if (filters.createdBy && ObjectId.isValid(filters.createdBy)) {
        query.createdBy = new ObjectId(filters.createdBy);
    }
    if (filters.search) {
        const escaped = String(filters.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (escaped) query.title = { $regex: escaped, $options: 'i' };
    }
    // catIds / subCatIds: comma-separated lists from the course builder filter.
    // A course matches if it is in any selected category OR has any selected sub-category.
    const toIds = (v) => String(v || '').split(',').filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
    const catIds = toIds(filters.catIds);
    const subCatIds = toIds(filters.subCatIds);
    const or = [];
    if (catIds.length) or.push({ catId: { $in: catIds } }, { catIds: { $in: catIds } });
    if (subCatIds.length) or.push({ subCatIds: { $in: subCatIds } });
    if (or.length) query.$or = or;
    return query;
};

export const createCourse = async (data, userId) => {
    try {
        const slug = generateSlug(data.title);
        return await new Course({
            title: data.title,
            slug,
            desc: data.desc,
            catId: null,
            catIds: [],
            ...categoryFields(data),
            subCatIds: Array.isArray(data.subCatIds) ? data.subCatIds : [],
            tagIds: Array.isArray(data.tagIds) ? data.tagIds : [],
            level: data.level || 'beginner',
            course_image: data.course_image || null,
            intro_video: data.intro_video || null,
            introVideoStatus: data.introVideoStatus || null, // set by the controller, never from the request
            intro_video_url: data.intro_video_url || null,
            course_price: data.course_price !== undefined ? mongoose.Types.Decimal128.fromString(String(data.course_price)) : mongoose.Types.Decimal128.fromString('0.00'),
            duration_hr: data.duration_hr || '0',
            duration_min: data.duration_min || '0',
            totalChapters: data.totalChapters || 0,
            max_students: data.max_students || 0,
            enable_review: data.enable_review !== undefined ? data.enable_review : true,
            qna_enabled: data.qna_enabled !== undefined ? data.qna_enabled : false,
            what_will_learn: data.what_will_learn || '',
            target_audience: data.target_audience || '',
            materials_included: data.materials_included || '',
            requirements: data.requirements || '',
            aptitudeEnabled: data.aptitudeEnabled !== undefined ? data.aptitudeEnabled : false,
            aptitudeContext: data.aptitudeContext || '',
            aptitudeSelectedQuestionIds: Array.isArray(data.aptitudeSelectedQuestionIds) ? data.aptitudeSelectedQuestionIds : [],
            aptitudeSettings: sanitizeAptitudeSettings(data.aptitudeSettings),
            certificate_template_id: data.certificate_template_id || null,
            createdBy: userId,
            status: data.status || 'draft'
        }).save();
    } catch (error) {
        throw error;
    }
};

export const editCourse = async (editId) => {
    try {
        return await Course.findOne({ _id: editId, deletedAt: null })
            .populate('catId', '_id title slug')
            .populate('catIds', '_id title slug')
            .populate('subCatIds', '_id name slug')
            .populate('createdBy', '_id name email')
            .populate('certificate_template_id', '_id title slug desc status')
            .lean();
    } catch (error) {
        throw error;
    }
};

export const updateCourse = async (updateId, data) => {
    try {
        const fields = [
            'desc', 'subCatIds', 'tagIds', 'level', 'course_image',
            'intro_video', 'introVideoStatus', 'intro_video_url', 'duration_hr', 'duration_min',
            'totalChapters', 'status', 'max_students', 'enable_review', 'qna_enabled',
            'what_will_learn', 'target_audience', 'materials_included', 'requirements',
            'aptitudeEnabled', 'aptitudeContext', 'aptitudeSelectedQuestionIds',
            'certificate_template_id'
        ];
        const updateFields = { ...categoryFields(data) };
        if (data.aptitudeSettings !== undefined) updateFields.aptitudeSettings = sanitizeAptitudeSettings(data.aptitudeSettings);

        if (data.course_price !== undefined) {
            updateFields.course_price = mongoose.Types.Decimal128.fromString(String(data.course_price));
        }

        if (data.title !== undefined) {
            updateFields.title = data.title;
            updateFields.slug = generateSlug(data.title);
        }
        for (const field of fields) {
            if (data[field] !== undefined) updateFields[field] = data[field];
        }

        if (Object.keys(updateFields).length === 0) {
            return await Course.findOne({ _id: updateId, deletedAt: null }).lean();
        }

        updateFields.updatedAt = new Date();

        return await Course.findOneAndUpdate(
            { _id: updateId, deletedAt: null },
            { $set: updateFields },
            { returnDocument: 'before', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listCourse = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Course.find(query)
            .populate('catId', '_id title slug')
            .populate('catIds', '_id title slug')
            .populate('subCatIds', '_id name slug')
            .populate('createdBy', '_id name email')
            .sort({ createdAt: -1 })
            .lean();
    } catch (error) {
        throw error;
    }
};

export const listCoursePagination = async (page, limit, filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Course.find(query)
            .populate('catId', '_id title slug')
            .populate('catIds', '_id title slug')
            .populate('subCatIds', '_id name slug')
            .populate('createdBy', '_id name email')
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
    } catch (error) {
        throw error;
    }
};

export const getCourseCount = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Course.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

// Deleting a course also deletes its chapters and lessons, and removes the intro video and
// every lesson video from disk (_helpers/deleteVideoFiles.js).
export const deleteCourse = async (delId) => {
    try {
        const deletedAt = new Date();
        const deleted = await Course.findOneAndUpdate(
            { _id: delId, deletedAt: null },
            { $set: { deletedAt, status: 'deleted', ...CLEARED_INTRO_VIDEO } },
            { returnDocument: 'before' }
        ).lean();
        if (deleted) {
            await Chapter.updateMany(
                { courseId: deleted._id, deletedAt: null },
                { $set: { deletedAt, status: 'inactive' } }
            );
            const lessonVideos = await deleteLessonsWithVideos({ courseId: deleted._id }, deletedAt);
            await deleteVideoFiles([deleted.intro_video, ...lessonVideos]);
        }
        return deleted;
    } catch (error) {
        throw error;
    }
};

export const checkCourseTitle = async (title, catId, excludeId = null) => {
    try {
        const query = {
            title: { $regex: `^${title}$`, $options: 'i' },
            catId,
            deletedAt: null
        };
        if (excludeId) query._id = { $ne: excludeId };
        const existing = await Course.findOne(query).lean();
        return { isDuplicate: !!existing };
    } catch (error) {
        throw error;
    }
};

export const listCoursesWithStats = async (filters = {}) => {
    try {
        const query = { deletedAt: null };
        if (filters.status) query.status = filters.status;

        const courses = await Course.find(query)
            .select('_id title status totalChapters')
            .sort({ createdAt: -1 })
            .lean();

        const courseIds = courses.map(c => c._id);

        const [chapterCounts, topicCounts] = await Promise.all([
            Chapter.aggregate([
                { $match: { courseId: { $in: courseIds }, deletedAt: null } },
                { $group: { _id: '$courseId', count: { $sum: 1 } } }
            ]),
            Topic.aggregate([
                { $match: { courseId: { $in: courseIds }, deletedAt: null } },
                { $group: { _id: '$courseId', count: { $sum: 1 } } }
            ])
        ]);

        const chapterMap = Object.fromEntries(chapterCounts.map(r => [r._id.toString(), r.count]));
        const topicMap   = Object.fromEntries(topicCounts.map(r => [r._id.toString(), r.count]));

        return courses.map(c => ({
            _id: c._id,
            title: c.title,
            status: c.status,
            chapters: chapterMap[c._id.toString()] || 0,
            topics:   topicMap[c._id.toString()]   || 0,
        }));
    } catch (error) {
        throw error;
    }
};
