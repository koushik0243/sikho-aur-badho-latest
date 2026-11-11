import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';
import * as CourseSubCategoryHelper from './course_subcategory.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const Router = express.Router();

// ── Multer configuration ──────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'course_subcategory');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const subCategoryUpload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })
    .single('cat_subcat_image');

// Helper: parse body + attach uploaded file path
const parseBodyWithFile = (req) => {
    const body = { ...req.body };
    if (req.file) {
        body.cat_subcat_image = `/uploads/course_subcategory/${req.file.filename}`;
    }
    return body;
};

const createCourseSubCategory = async (req, res, next) => {
    subCategoryUpload(req, res, async (err) => {
        if (err) return next(err);
        try {
            const userId = req.user?._id || null;
            const data = await CourseSubCategoryHelper.createCourseSubCategory(parseBodyWithFile(req), userId);
            res.status(200).json({ status: 200, message: "Successfully added.", data });
        } catch (error) {
            next(error);
        }
    });
};

const editCourseSubCategory = async (req, res, next) => {
    try {
        const data = await CourseSubCategoryHelper.editCourseSubCategory(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateCourseSubCategory = async (req, res, next) => {
    subCategoryUpload(req, res, async (err) => {
        if (err) return next(err);
        try {
            const data = await CourseSubCategoryHelper.updateCourseSubCategory(req.params.id, parseBodyWithFile(req));
            res.status(200).json({ status: 200, message: "Successfully updated.", data });
        } catch (error) {
            next(error);
        }
    });
};

const listCourseSubCategory = async (req, res, next) => {
    try {
        const { status, categoryId } = req.query;
        const data = await CourseSubCategoryHelper.listCourseSubCategory({ status, categoryId });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listCourseSubCategoryPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status, categoryId } = req.query;

        const [subcategories, total] = await Promise.all([
            CourseSubCategoryHelper.listCourseSubCategoryPagination(page, limit, { status, categoryId }),
            CourseSubCategoryHelper.getCourseSubCategoryCount({ status, categoryId })
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: subcategories,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        next(error);
    }
};

const deleteCourseSubCategory = async (req, res, next) => {
    try {
        const data = await CourseSubCategoryHelper.deleteCourseSubCategory(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

const checkCourseSubCategoryName = async (req, res, next) => {
    try {
        const { name, excludeId } = req.query;
        if (!name) {
            return res.status(400).json({ status: 400, message: "name is required." });
        }
        const data = await CourseSubCategoryHelper.checkCourseSubCategoryName(name, excludeId || null);
        res.status(200).json({ status: 200, message: "Successfully checked.", data });
    } catch (error) {
        next(error);
    }
};

Router.post('/create', createCourseSubCategory);
Router.get('/list', listCourseSubCategory);
Router.get('/list-pagination', listCourseSubCategoryPagination);
Router.get('/check', checkCourseSubCategoryName);
Router.get('/edit/:id', editCourseSubCategory);
Router.put('/update/:id', updateCourseSubCategory);
Router.get('/delete/:id', deleteCourseSubCategory);
Router.get('/:id', editCourseSubCategory);

export default Router;
