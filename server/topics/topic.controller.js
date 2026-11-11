import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import multer from 'multer';
import * as TopicHelper from './topic.service.js';
import Topic from './topic.model.js';
import { prepareTranscriptInBackgroundById } from './topic.transcript.js';
import {
    initialVideoStatus, isLocalUploadPath, queueVideoConversion,
    isAllowedVideoName, ALLOWED_VIDEO_FORMATS_LABEL, MAX_VIDEO_BYTES, MAX_VIDEO_LABEL,
} from '../_helpers/videoConvert.js';
import { requireSuperAdmin } from '../middleware/authMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const Router = express.Router();

// ── Multer for topic file uploads (assignment & lesson image) ─────────────────
const topicStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const subDir = file.fieldname === 'lesson_image' ? 'lesson-images'
                     : file.fieldname === 'lesson_video' ? 'lesson-videos'
                     : 'assignments';
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads', subDir);
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
});

const topicFileFilter = (req, file, cb) => {
    if (file.fieldname === 'lesson_image') {
        const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error(`Invalid image type. Allowed: ${allowed.join(', ')}`));
    } else if (file.fieldname === 'lesson_video') {
        if (isAllowedVideoName(file.originalname)) cb(null, true);
        else cb(Object.assign(new Error(`Please upload a video in ${ALLOWED_VIDEO_FORMATS_LABEL} format.`), { statusCode: 400 }));
    } else {
        const allowed = ['.doc', '.docx', '.pdf', '.ppt', '.pptx', '.zip', '.rar'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error(`Invalid file type. Allowed: ${allowed.join(', ')}`));
    }
};

// Lesson videos may be up to 2 GB (the app-wide video rule, videoConvert.js). They are
// converted to MP3 and transcribed, never sent to OpenAI as-is (topic.transcript.js).
// Every other file keeps the 100 MB cap.
const MAX_LESSON_VIDEO_BYTES = MAX_VIDEO_BYTES;
const MAX_OTHER_FILE_BYTES = 100 * 1024 * 1024;

const topicUpload = multer({
    storage: topicStorage,
    fileFilter: topicFileFilter,
    limits: { fileSize: MAX_LESSON_VIDEO_BYTES } // per-field caps are checked in rejectOversizedFiles
}).fields([
    { name: 'assignment_file', maxCount: 1 },
    { name: 'lesson_image', maxCount: 1 },
    { name: 'lesson_video', maxCount: 1 }
]);

// multer's limit is one number for every field, so the tighter 100 MB cap on
// assignment_file/lesson_image is enforced here, after the files are on disk. The client
// also blocks oversized selections (AddCourseBuilder.js), but that's just UX. On
// rejection every uploaded file is deleted so nothing half-saved is left behind.
// Deletes this request's uploads (a failed save would otherwise leave up to 2 GB behind).
function removeUploadedFiles(files) {
    Object.values(files || {}).flat().forEach(f => fs.unlink(f.path, () => {}));
}

function rejectOversizedFiles(files) {
    const all = Object.values(files).flat();
    const tooLarge = all.find(f => f.size > (f.fieldname === 'lesson_video' ? MAX_LESSON_VIDEO_BYTES : MAX_OTHER_FILE_BYTES));
    if (!tooLarge) return;
    removeUploadedFiles(files);
    const err = new Error(tooLarge.fieldname === 'lesson_video'
        ? `Lesson video exceeds the ${MAX_VIDEO_LABEL} size limit.`
        : 'File exceeds the 100 MB size limit.');
    err.statusCode = 400;
    throw err;
}

// multer reports a file over the 2 GB limit as LIMIT_FILE_SIZE; give it a clear message.
function uploadError(err) {
    if (err?.code !== 'LIMIT_FILE_SIZE') return err;
    const friendly = new Error(`Lesson video exceeds the ${MAX_VIDEO_LABEL} size limit.`);
    friendly.statusCode = 400;
    return friendly;
}

// Sets the lesson's video fields from the request. An uploaded file is probed: one that
// already plays in every browser is 'ready'; anything else is 'processing' until
// videoConvert.js turns it into an MP4. Only an upload can point videoUrl at a local
// /uploads/ file — a path sent as text (e.g. a stale one the builder still holds after
// conversion renamed the file) is ignored. The status is never taken from the request.
async function applyLessonVideo(body, files) {
    delete body.videoStatus;
    const file = files.lesson_video?.[0];
    if (file) {
        body.videoUrl = `/uploads/lesson-videos/${file.filename}`;
        body.videoStatus = await checkUploadedVideo(file.path);
        return;
    }
    if (isLocalUploadPath(body.videoUrl)) {
        delete body.videoUrl;
    } else if (body.videoUrl !== undefined) {
        body.videoStatus = null; // video removed, or replaced by an external URL
    }
}

async function checkUploadedVideo(filePath) {
    try {
        return await initialVideoStatus(filePath);
    } catch (probeErr) {
        const err = new Error(`${probeErr.message} Please upload a video in ${ALLOWED_VIDEO_FORMATS_LABEL} format.`);
        err.statusCode = 400;
        throw err;
    }
}

// After saving: convert the video if needed (the transcript follows once it is an MP4),
// otherwise start the MP3 + transcript now so it's ready by the time QA is generated.
function afterLessonVideoSaved(topic) {
    if (!topic?._id || !topic.videoUrl) return;
    if (topic.videoStatus === 'processing') {
        queueVideoConversion({
            model: Topic, id: topic._id, field: 'videoUrl', statusField: 'videoStatus',
            url: topic.videoUrl, onReady: prepareTranscriptInBackgroundById,
        });
    } else {
        prepareTranscriptInBackgroundById(topic._id);
    }
}

const createTopic = async (req, res, next) => {
    topicUpload(req, res, async (err) => {
        if (err) return next(uploadError(err));
        try {
            const body = { ...req.body };
            const files = req.files || {};
            rejectOversizedFiles(files);
            if (files.assignment_file?.[0]) {
                body.attachments = [{ name: files.assignment_file[0].originalname, url: `/uploads/assignments/${files.assignment_file[0].filename}` }];
            }
            if (files.lesson_image?.[0]) {
                body.imageUrl = `/uploads/lesson-images/${files.lesson_image[0].filename}`;
            }
            await applyLessonVideo(body, files);
            const data = await TopicHelper.createTopic(body);
            if (files.lesson_video?.[0]) afterLessonVideoSaved(data);
            res.status(200).json({ status: 200, message: "Successfully added.", data });
        } catch (error) {
            removeUploadedFiles(req.files);
            next(error);
        }
    });
};

const editTopic = async (req, res, next) => {
    try {
        const data = await TopicHelper.editTopic(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateTopic = async (req, res, next) => {
    topicUpload(req, res, async (err) => {
        if (err) return next(uploadError(err));
        try {
            const body = { ...req.body };
            const files = req.files || {};
            rejectOversizedFiles(files);
            if (files.lesson_image?.[0]) {
                body.imageUrl = `/uploads/lesson-images/${files.lesson_image[0].filename}`;
            }
            await applyLessonVideo(body, files);
            const data = await TopicHelper.updateTopic(req.params.id, body);
            if (!data) removeUploadedFiles(files); // no such lesson: nothing references the upload
            else if (files.lesson_video?.[0]) afterLessonVideoSaved(data);
            res.status(200).json({ status: 200, message: "Successfully updated.", data });
        } catch (error) {
            removeUploadedFiles(req.files);
            next(error);
        }
    });
};

const listTopic = async (req, res, next) => {
    try {
        const { status, courseId, chapterId } = req.query;
        const data = await TopicHelper.listTopic({ status, courseId, chapterId });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listTopicPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status, courseId, chapterId } = req.query;

        const [topics, total] = await Promise.all([
            TopicHelper.listTopicPagination(page, limit, { status, courseId, chapterId }),
            TopicHelper.getTopicCount({ status, courseId, chapterId })
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: topics,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        next(error);
    }
};

const deleteTopic = async (req, res, next) => {
    try {
        const data = await TopicHelper.deleteTopic(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

const checkTopicTitle = async (req, res, next) => {
    try {
        const { title, courseId, chapterId, excludeId } = req.query;
        if (!title || !courseId || !chapterId) {
            return res.status(400).json({ status: 400, message: "title, courseId, and chapterId are required." });
        }
        const data = await TopicHelper.checkTopicTitle(title, courseId, chapterId, excludeId || null);
        res.status(200).json({ status: 200, message: "Successfully checked.", data });
    } catch (error) {
        next(error);
    }
};

// Only super admins build courses. The guard runs before multer, so a non-admin's
// upload (up to 2 GB, which also triggers paid transcription) is never written to disk.
Router.post('/create', requireSuperAdmin, createTopic);
Router.get('/list', listTopic);
Router.get('/list-pagination', listTopicPagination);
Router.get('/check', checkTopicTitle);
Router.get('/edit/:id', editTopic);
Router.put('/update/:id', requireSuperAdmin, updateTopic);
Router.get('/delete/:id', requireSuperAdmin, deleteTopic);
Router.get('/:id', editTopic);

export default Router;
