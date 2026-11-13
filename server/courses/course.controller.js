import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import multer from 'multer';
import * as CourseHelper from './course.service.js';
import Course from './course.model.js';
import { requireSuperAdmin } from '../middleware/authMiddleware.js';
import { deletedCourseError, isCourseDeleted } from '../_helpers/deletedCourse.js';
import {
    initialVideoStatus, isLocalUploadPath, queueVideoConversion,
    isAllowedVideoName, ALLOWED_VIDEO_FORMATS_LABEL, MAX_VIDEO_BYTES, MAX_VIDEO_LABEL,
} from '../_helpers/videoConvert.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const Router = express.Router();

// ── Multer configuration ──────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const subfolder = file.fieldname === 'intro_video' ? 'videos' : 'images';
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'courses', subfolder);
        import('fs').then(({ default: fs }) => {
            fs.mkdirSync(uploadDir, { recursive: true });
            cb(null, uploadDir);
        });
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
});

// Intro videos follow the app-wide video rule (videoConvert.js: MP4, WebM, MOV, AVI, MKV;
// up to 2 GB). Files that don't play in every browser are converted to MP4 after upload.
const badFile = (message) => Object.assign(new Error(message), { statusCode: 400 });

const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'course_image') {
        if (!file.mimetype.startsWith('image/')) {
            return cb(badFile('Only image files are allowed for course image.'));
        }
    }
    if (file.fieldname === 'intro_video') {
        if (!isAllowedVideoName(file.originalname)) {
            return cb(badFile(`Please upload a video in ${ALLOWED_VIDEO_FORMATS_LABEL} format.`));
        }
    }
    cb(null, true);
};

// The intro video may be up to 2 GB, like lesson and assignment videos. The course
// image keeps its 500 MB cap. multer's limit is one number for every field, so the
// image cap is checked in rejectOversizedFiles once the files are on disk.
const MAX_INTRO_VIDEO_BYTES = MAX_VIDEO_BYTES;
const MAX_COURSE_IMAGE_BYTES = 500 * 1024 * 1024;

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_INTRO_VIDEO_BYTES } });
const courseUpload = upload.fields([
    { name: 'course_image', maxCount: 1 },
    { name: 'intro_video', maxCount: 1 }
]);

// Deletes this request's uploads (a failed save would otherwise leave up to 2 GB behind).
const removeUploadedFiles = (files) => {
    Object.values(files || {}).flat().forEach(f => fs.unlink(f.path, () => {}));
};

const rejectOversizedFiles = (files) => {
    const image = files?.course_image?.[0];
    if (!image || image.size <= MAX_COURSE_IMAGE_BYTES) return;
    removeUploadedFiles(files);
    const err = new Error('Course image exceeds the 500 MB size limit.');
    err.statusCode = 400;
    throw err;
};

// multer reports a file over the 2 GB limit as LIMIT_FILE_SIZE; give it a clear message.
const uploadError = (err) => {
    if (err?.code !== 'LIMIT_FILE_SIZE') return err;
    const friendly = new Error(`Intro video exceeds the ${MAX_VIDEO_LABEL} size limit.`);
    friendly.statusCode = 400;
    return friendly;
};

// Helper: parse body + attach uploaded file paths
const parseBodyWithFiles = (req) => {
    const body = { ...req.body };
    // Parse JSON-stringified arrays sent via FormData
    ['catIds', 'subCatIds', 'tagIds', 'aptitudeSelectedQuestionIds'].forEach(key => {
        if (typeof body[key] === 'string') {
            try { body[key] = JSON.parse(body[key]); } catch { body[key] = [body[key]]; }
        }
    });
    // Aptitude settings arrive as a JSON string via FormData, or an object via JSON
    if (typeof body.aptitudeSettings === 'string') {
        try { body.aptitudeSettings = JSON.parse(body.aptitudeSettings); } catch { delete body.aptitudeSettings; }
    }
    // Boolean coercion from FormData strings
    if (body.enable_review !== undefined) body.enable_review = body.enable_review === 'true' || body.enable_review === true;
    if (body.qna_enabled !== undefined) body.qna_enabled = body.qna_enabled === 'true' || body.qna_enabled === true;
    if (body.aptitudeEnabled !== undefined) body.aptitudeEnabled = body.aptitudeEnabled === 'true' || body.aptitudeEnabled === true;
    // Number coercion
    if (body.max_students !== undefined) body.max_students = Number(body.max_students) || 0;
    // Attach uploaded file paths
    if (req.files?.course_image?.[0]) {
        const img = req.files.course_image[0];
        body.course_image = `/uploads/courses/images/${img.filename}`;
    }
    // The playback status is only ever set here, never taken from the request, and only an
    // upload can point intro_video at a local /uploads/ file.
    delete body.introVideoStatus;
    if (isLocalUploadPath(body.intro_video)) delete body.intro_video;
    if (req.files?.intro_video?.[0]) {
        const vid = req.files.intro_video[0];
        body.intro_video = `/uploads/courses/videos/${vid.filename}`;
    }
    return body;
};

// An uploaded intro video is probed: one that already plays in every browser is
// 'ready'; anything else is 'processing' until videoConvert.js turns it into an MP4.
const parseBodyWithIntroVideo = async (req) => {
    const body = parseBodyWithFiles(req);
    const vid = req.files?.intro_video?.[0];
    if (!vid) return body;
    try {
        body.introVideoStatus = await initialVideoStatus(vid.path);
    } catch (probeErr) {
        const err = new Error(`${probeErr.message} Please upload a video in ${ALLOWED_VIDEO_FORMATS_LABEL} format.`);
        err.statusCode = 400;
        throw err;
    }
    return body;
};

const afterIntroVideoSaved = (course) => {
    if (course?.introVideoStatus !== 'processing' || !course.intro_video) return;
    queueVideoConversion({
        model: Course, id: course._id, field: 'intro_video', statusField: 'introVideoStatus', url: course.intro_video,
    });
};

const createCourse = async (req, res, next) => {
    courseUpload(req, res, async (err) => {
        if (err) return next(uploadError(err));
        try {
            rejectOversizedFiles(req.files);
            const userId = req.user?._id || null;
            const data = await CourseHelper.createCourse(await parseBodyWithIntroVideo(req), userId);
            if (req.files?.intro_video?.[0]) afterIntroVideoSaved(data);
            res.status(200).json({ status: 200, message: "Successfully added.", data });
        } catch (error) {
            removeUploadedFiles(req.files);
            next(error);
        }
    });
};

const editCourse = async (req, res, next) => {
    try {
        const data = await CourseHelper.editCourse(req.params.id);
        // A deleted course: say so (410) instead of an empty reply, so store owner and
        // learner screens can show "deleted, no longer available".
        if (!data && await isCourseDeleted(req.params.id)) throw deletedCourseError();
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateCourse = async (req, res, next) => {
    courseUpload(req, res, async (err) => {
        if (err) return next(uploadError(err));
        try {
            rejectOversizedFiles(req.files);
            const body = await parseBodyWithIntroVideo(req);
            const data = await CourseHelper.updateCourse(req.params.id, body);
            if (!data) removeUploadedFiles(req.files); // no such course: nothing references the upload
            // updateCourse returns the course as it was *before* the update, so use what was saved.
            else if (req.files?.intro_video?.[0]) afterIntroVideoSaved({ _id: data._id, ...body });
            res.status(200).json({ status: 200, message: "Successfully updated.", data });
        } catch (error) {
            removeUploadedFiles(req.files);
            next(error);
        }
    });
};

const listCourse = async (req, res, next) => {
    try {
        const { status, catId, level, createdBy } = req.query;
        const data = await CourseHelper.listCourse({ status, catId, level, createdBy });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listCoursesWithStats = async (req, res, next) => {
    try {
        const { status } = req.query;
        const data = await CourseHelper.listCoursesWithStats({ status });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listCoursePagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status, catId, level, createdBy, search, catIds, subCatIds } = req.query;
        const filters = { status, catId, level, createdBy, search, catIds, subCatIds };

        const [courses, total] = await Promise.all([
            CourseHelper.listCoursePagination(page, limit, filters),
            CourseHelper.getCourseCount(filters)
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: courses,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        next(error);
    }
};

const deleteCourse = async (req, res, next) => {
    try {
        const data = await CourseHelper.deleteCourse(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

const checkCourseTitle = async (req, res, next) => {
    try {
        const { title, catId, excludeId } = req.query;
        if (!title || !catId) {
            return res.status(400).json({ status: 400, message: "title and catId are required." });
        }
        const data = await CourseHelper.checkCourseTitle(title, catId, excludeId || null);
        res.status(200).json({ status: 200, message: "Successfully checked.", data });
    } catch (error) {
        next(error);
    }
};

// Only super admins build courses. The guard runs before multer, so a non-admin's
// upload (intro video up to 2 GB) is never written to disk.
Router.post('/create', requireSuperAdmin, createCourse);
Router.get('/list', listCourse);
Router.get('/list-with-stats', listCoursesWithStats);
Router.get('/list-pagination', listCoursePagination);
Router.get('/check', checkCourseTitle);
Router.get('/edit/:id', editCourse);
Router.put('/update/:id', requireSuperAdmin, updateCourse);
Router.get('/delete/:id', requireSuperAdmin, deleteCourse);
Router.get('/:id', editCourse);

export default Router;
