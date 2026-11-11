import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';
import * as CourseCategoryHelper from './course_category.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const Router = express.Router();

// ── Multer configuration ──────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'course_category');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const categoryUpload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })
    .single('cat_subcat_image');

// Helper: parse body + attach uploaded file path
const parseBodyWithFile = (req) => {
    const body = { ...req.body };
    if (req.file) {
        body.cat_subcat_image = `/uploads/course_category/${req.file.filename}`;
    }
    return body;
};

const createCourseCategory = async (req, res, next) => {
    categoryUpload(req, res, async (err) => {
        if (err) return next(err);
        try {
            const userId = req.user?._id || null;
            const data = await CourseCategoryHelper.createCourseCategory(parseBodyWithFile(req), userId);
            res.status(200).json({ status: 200, message: "Successfully added.", data });
        } catch (error) {
            next(error);
        }
    });
};

const editCourseCategory = async (req, res, next) => {
    try {
        const data = await CourseCategoryHelper.editCourseCategory(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateCourseCategory = async (req, res, next) => {
    categoryUpload(req, res, async (err) => {
        if (err) return next(err);
        try {
            const data = await CourseCategoryHelper.updateCourseCategory(req.params.id, parseBodyWithFile(req));
            res.status(200).json({ status: 200, message: "Successfully updated.", data });
        } catch (error) {
            next(error);
        }
    });
};

const listCourseCategory = async (req, res, next) => {
    try {
        const { status } = req.query;
        const data = await CourseCategoryHelper.listCourseCategory({ status });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listCourseCategoryPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status } = req.query;

        const [categories, total] = await Promise.all([
            CourseCategoryHelper.listCourseCategoryPagination(page, limit, { status }),
            CourseCategoryHelper.getCourseCategoryCount({ status })
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: categories,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        next(error);
    }
};

const deleteCourseCategory = async (req, res, next) => {
    try {
        const data = await CourseCategoryHelper.deleteCourseCategory(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

const checkCourseCategoryTitle = async (req, res, next) => {
    try {
        const { title, excludeId } = req.query;
        if (!title) {
            return res.status(400).json({ status: 400, message: "title is required." });
        }
        const data = await CourseCategoryHelper.checkCourseCategoryTitle(title, excludeId || null);
        res.status(200).json({ status: 200, message: "Successfully checked.", data });
    } catch (error) {
        next(error);
    }
};

const listAllCategories = async (req, res, next) => {
    try {
        const data = await CourseCategoryHelper.listAllCategories();
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const deleteCategoryTree = async (req, res, next) => {
    try {
        const data = await CourseCategoryHelper.deleteCategoryTree(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

Router.post('/create', createCourseCategory);
Router.get('/list-all', listAllCategories);
Router.get('/list', listCourseCategory);
Router.get('/list-pagination', listCourseCategoryPagination);
Router.get('/check', checkCourseCategoryTitle);
Router.get('/edit/:id', editCourseCategory);
Router.put('/update/:id', updateCourseCategory);
Router.get('/delete-tree/:id', deleteCategoryTree);
Router.get('/delete/:id', deleteCourseCategory);
Router.get('/:id', editCourseCategory);

export default Router;
