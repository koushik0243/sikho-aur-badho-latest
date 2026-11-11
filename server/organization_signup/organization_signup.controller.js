import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';
import * as SignupHelper from './organization_signup.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const Router = express.Router();

// Same upload destination/naming convention as organization.controller.js's own
// org_logo upload, so logos from either flow land in the same place.
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
const logoUpload = upload.fields([{ name: 'org_logo', maxCount: 1 }]);

const listIndustryTypes = async (req, res, next) => {
    try {
        const data = await SignupHelper.listIndustryTypesForSignup();
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const signup = async (req, res, next) => {
    logoUpload(req, res, async (err) => {
        if (err) return next(err);
        try {
            const body = { ...(req.body || {}) };
            if (typeof body.industryTypeIds === 'string') {
                try { body.industryTypeIds = JSON.parse(body.industryTypeIds); } catch { body.industryTypeIds = []; }
            }
            if (req.files?.org_logo?.[0]) {
                body.org_logo = `/uploads/organizations/${req.files.org_logo[0].filename}`;
            }
            const data = await SignupHelper.signupOrganization(body);
            res.status(200).json({ status: 200, message: "Organization created. You can now log in.", data });
        } catch (error) {
            next(error);
        }
    });
};

Router.get('/industry-types', listIndustryTypes);
Router.post('/', signup);

export default Router;
