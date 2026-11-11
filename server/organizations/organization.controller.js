import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';
import * as OrganizationHelper from './organization.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const Router = express.Router();

// ── Multer configuration ──────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'organizations');
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

const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'org_logo' && !file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed for organization logo.'));
    }
    cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const orgUpload = upload.fields([{ name: 'org_logo', maxCount: 1 }]);

// Parse FormData body and attach uploaded file paths
const parseBodyWithFiles = (req) => {
    const body = { ...(req.body || {}) };
    if (typeof body.course_ids === 'string') {
        try { body.course_ids = JSON.parse(body.course_ids); } catch { body.course_ids = []; }
    }
    if (typeof body.industryTypeIds === 'string') {
        try { body.industryTypeIds = JSON.parse(body.industryTypeIds); } catch { body.industryTypeIds = []; }
    }
    if (req.files?.org_logo?.[0]) {
        body.org_logo = `/uploads/organizations/${req.files.org_logo[0].filename}`;
    }
    return body;
};

const checkOrganizationName = async (req, res, next) => {
    try {
        const { name, excludeId } = req.query;
        const data = await OrganizationHelper.checkOrganizationName(name, excludeId || null);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const createOrganization = async (req, res, next) => {
    orgUpload(req, res, async (err) => {
        if (err) return next(err);
        try {
            const data = await OrganizationHelper.createOrganization(parseBodyWithFiles(req));
            res.status(200).json({ status: 200, message: "Successfully added.", data });
        } catch (error) {
            next(error);
        }
    });
};

const editOrganization = async (req, res, next) => {
    try {
        const data = await OrganizationHelper.editOrganization(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateOrganization = async (req, res, next) => {
    orgUpload(req, res, async (err) => {
        if (err) return next(err);
        try {
            const data = await OrganizationHelper.updateOrganization(req.params.id, parseBodyWithFiles(req));
            res.status(200).json({ status: 200, message: "Successfully updated.", data });
        } catch (error) {
            next(error);
        }
    });
};

const listOrganization = async (req, res, next) => {
    try {
        const { status, ownerId, search } = req.query;
        const data = await OrganizationHelper.listOrganization({ status, ownerId, search });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listOrganizationPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { status, ownerId, search } = req.query;

        const [organizations, total] = await Promise.all([
            OrganizationHelper.listOrganizationPagination(page, limit, { status, ownerId, search }),
            OrganizationHelper.getOrganizationCount({ status, ownerId, search })
        ]);
        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: organizations,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        next(error);
    }
};

const deleteOrganization = async (req, res, next) => {
    try {
        const data = await OrganizationHelper.deleteOrganization(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

Router.get('/check', checkOrganizationName);
Router.post('/create', createOrganization);
Router.get('/list', listOrganization);
Router.get('/list-pagination', listOrganizationPagination);
Router.get('/edit/:id', editOrganization);
Router.put('/update/:id', updateOrganization);
Router.get('/delete/:id', deleteOrganization);
Router.get('/:id', editOrganization);

export default Router;
