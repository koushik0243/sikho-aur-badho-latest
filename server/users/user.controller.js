import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
const Router = express.Router();
import * as UserHelper from './user.service.js';
import User from './user.model.js';
import protect, { requireSuperAdmin } from '../middleware/authMiddleware.js';
import RolePermission from '../role_permissions/role_permission.model.js';
//import otpGenerator from 'otp-generator';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import crypto from 'crypto';

const transporter = nodemailer.createTransport({
    service: process.env.PROVIDER_NAME,
    auth: {
        user: process.env.USER_EMAIL,
        pass: process.env.USER_PASSWORD
    }
});

const buildAdminLoginOtpMail = (otp) => `<div class="container" style="max-width: 600px; margin: auto;">
                        <div class="card" style="border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1); border: 2px solid #000; padding: 0px 20px 10px;  background-color: #f8f9fa;">
                        <div class="card-body">

                            <h2 class="text-center text-primary mb-4">OTP Verification</h2>
                            <p class="text-center">Your One-Time Password (OTP) is:</p>
                            <h3 class="text-center" style="font-weight: bold; color: #d9534f;"> ${otp} </h3>
                            <p class="text-center">Please enter this OTP to complete your login.</p>

                            <hr>
                            <p class="text-center" style="font-size: 14px; color: #6c757d;">
                            If you did not request this OTP, please ignore this email.
                            </p>

                            <hr>
                            <div class="text-center mt-4">
                            <p class="text-muted" style="font-size: 12px;">Powered by Womenka Trends Pvt. Ltd.</p>
                            </div>
                        </div>
                        </div>
                    </div>`;

const getRequestedOtpChannels = (requestBody = {}) => {
    const normalizedChannels = new Set();
    const channelFields = [
        requestBody.otp_channels,
        requestBody.otpChannels,
        requestBody.otpDelivery,
        requestBody.otp_delivery,
        requestBody.otpMethod,
        requestBody.otp_method,
        requestBody.otpBy,
        requestBody.otp_by,
        requestBody.sendOtpBy,
        requestBody.deliveryMode,
        requestBody.deliveryMethods,
        requestBody.channels,
        requestBody.deliveryChannel,
    ];

    const addChannelValue = (value) => {
        if (!value) {
            return;
        }

        if (Array.isArray(value)) {
            value.forEach(addChannelValue);
            return;
        }

        if (typeof value === 'object') {
            Object.entries(value).forEach(([key, enabled]) => {
                if (enabled) {
                    addChannelValue(key);
                }
            });
            return;
        }

        if (typeof value !== 'string') {
            return;
        }

        value
            .split(/[,+/|]/)
            .map((item) => item.trim().toLowerCase())
            .forEach((item) => {
                if (['both', 'all', 'sms and email', 'email and sms'].includes(item)) {
                    normalizedChannels.add('sms');
                    normalizedChannels.add('email');
                    return;
                }

                if (['sms', 'text', 'mobile'].includes(item)) {
                    normalizedChannels.add('sms');
                }

                if (['email', 'mail'].includes(item)) {
                    normalizedChannels.add('email');
                }
            });
    };

    channelFields.forEach(addChannelValue);

    if (requestBody.sendOtpBySms || requestBody.otpBySms || requestBody.smsOtp || requestBody.sms_otp || requestBody.useSms) {
        normalizedChannels.add('sms');
    }

    if (requestBody.sendOtpByEmail || requestBody.otpByEmail || requestBody.emailOtp || requestBody.email_otp || requestBody.useEmail) {
        normalizedChannels.add('email');
    }

    return [...normalizedChannels];
};

const normalizeIndianMobileNumber = (phoneNumber) => {
    const digitsOnly = String(phoneNumber || '').replace(/\D/g, '');

    if (digitsOnly.length === 10) {
        return digitsOnly;
    }

    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        return digitsOnly.slice(2);
    }

    if (digitsOnly.length === 13 && digitsOnly.startsWith('091')) {
        return digitsOnly.slice(3);
    }

    return null;
};

const sendAdminLoginOtpSms = async ({ otp, phone, type = 'otp' }) => {
    const normalizedApiKey = String(process.env.FAST2SMS_API_KEY || '')
        .trim()
        .replace(/^['\"]|['\"]$/g, '')
        .replace(/^Bearer\s+/i, '')
        .replace(/\s+/g, '');

    if (!normalizedApiKey) {
        const error = new Error('FAST2SMS API key is not configured.');
        error.statusCode = 500;
        throw error;
    }

    const normalizedPhone = normalizeIndianMobileNumber(phone);
    if (!normalizedPhone) {
        const error = new Error('A valid mobile number is required for SMS OTP.');
        error.statusCode = 400;
        throw error;
    }

    const templates = {
        registration: '205249',
        otp: '205250',
        readyshipping: '205251',
        docsverification: '205252',
        orderplaced: '205253',
    };

    const normalizedType = String(type || 'otp').trim().toLowerCase();
    const templateId = templates[normalizedType];

    if (!templateId) {
        const error = new Error('Invalid SMS template type.');
        error.statusCode = 400;
        throw error;
    }

    const payload = {
        route: 'dlt',
        sender_id: process.env.FAST2SMS_SENDER_ID || 'DHBROT',
        message: templateId,
        variables_values: String(otp),
        numbers: normalizedPhone,
        schedule_time: '',
        flash: 0,
    };

    try {
        const smsResponse = await axios.post('https://www.fast2sms.com/dev/bulkV2', payload, {
            headers: {
                authorization: normalizedApiKey,
                accept: 'application/json',
                'content-type': 'application/json',
            },
        });

        if (smsResponse.data?.return === false) {
            const smsMessage = Array.isArray(smsResponse.data?.message)
                ? smsResponse.data.message.join(', ')
                : smsResponse.data?.message;
            const error = new Error(smsMessage || 'Failed to send OTP over SMS.');
            error.statusCode = 502;
            throw error;
        }

        return smsResponse.data;
    } catch (err) {
        const providerData = err?.response?.data;
        const providerMessage = Array.isArray(providerData?.message)
            ? providerData.message.join(', ')
            : providerData?.message || err?.message;
        const providerStatus = err?.statusCode || err?.response?.status || 502;
        const finalMessage = providerMessage && !String(providerMessage).includes('Request failed with status code')
            ? providerMessage
            : (providerStatus === 400 || providerStatus === 401)
                ? 'SMS provider rejected the request. Please verify FAST2SMS authorization key and recipient mobile number.'
                : 'Failed to send OTP over SMS.';
        const error = new Error(finalMessage);
        error.statusCode = providerStatus;
        throw error;
    }
};

const sendAdminLoginOtpEmail = async ({ otp, email }) => {
    return transporter.sendMail({
        to: email,
        subject: 'Your OTP Code to Login - Womenka Trends Pvt. Ltd.',
        html: buildAdminLoginOtpMail(otp),
    });
};

const createUser = async (req, res, next) => {
    try {
        //check the email exist or not
        const check_email = await User.findOne({ email: req.body.email });
        if (check_email) {
            return res.status(400).json({ status: 400, message: "Email already exist." });
        }

        const otp = Math.floor(1000 + Math.random() * 9999);
        // const otp = otpGenerator.generate(4, { digits: true });
        const payload = {
            // full_name: req.body.full_name,
            // email: req.body.email,
            // password: req.body.password,
            // phone: req.body.phone,
            // otp: otp,
            // otpExpires: new Date(Date.now() + 15 * 60 * 1000),
            // isVerified: false,
            // status: req.body.status,
            name: req.body.name,
            email: req.body.email,
            password: req.body.password,
            phone: req.body.phone,
            alt_phone: req.body.alt_phone,
            dob: req.body.dob,
            gender: req.body.gender,
            bio: req.body.bio,
            user_type: req.body.user_type !== undefined ? req.body.user_type : 'employee',
            user_role: req.body.user_role || null,
            orgId: req.body.orgId,
            orgRole: req.body.orgRole,
            createdBy: req.body.createdBy,
            managerId: req.body.managerId,
            // Work Information
            designation: req.body.designation,
            department: req.body.department,
            emp_id: req.body.emp_id,
            whatsapp_no: req.body.whatsapp_no,
            course_language: req.body.course_language,
            access_start: req.body.access_start,
            address1: req.body.address1,
            address2: req.body.address2,
            city: req.body.city,
            state: req.body.state,
            country: req.body.country,
            zipcode: req.body.zipcode,
            // Social Links
            linkedin: req.body.linkedin,
            twitter: req.body.twitter,
            facebook: req.body.facebook,
            instagram: req.body.instagram,
            youtube: req.body.youtube,
            // Emergency Contact
            emergency_contact_name: req.body.emergency_contact_name,
            emergency_contact_phone: req.body.emergency_contact_phone,
            // Other
            other_info: req.body.other_info,
            // Status
            status: req.body.status

        }
        const data = await UserHelper.createUser(payload);

        // const mailOptions = {
        //                         from: '"Womenka Trends Pvt. Ltd." <koushik@thinksurfmedia.info>',  // Name + email address
        //                         to: req.body.email,
        //                         subject: 'Your OTP Code to Signup - Womenka Trends Pvt. Ltd.',
        //                         html: `<div class="container" style="max-width: 600px; margin: auto;">
        //                                     <div class="card" style="border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1); border: 2px solid #000; padding: 0px 20px 10px;  background-color: #f8f9fa;">
        //                                     <div class="card-body">

        //                                         <h2 class="text-center text-primary mb-4">OTP Verification</h2>
        //                                         <p class="text-center">Your One-Time Password (OTP) is:</p>        
        //                                         <h3 class="text-center" style="font-weight: bold; color: #d9534f;"> ${otp} </h3>        
        //                                         <p class="text-center">Please enter this OTP in the application to complete your verification.</p>

        //                                         <hr>
        //                                         <p class="text-center" style="font-size: 14px; color: #6c757d;">
        //                                         If you did not request this OTP, please ignore this email.
        //                                         </p>

        //                                         <hr>
        //                                         <div class="text-center mt-4">
        //                                         <p class="text-muted" style="font-size: 12px;">Powered by Womenka Trends Pvt. Ltd.</p>
        //                                         </div>
        //                                     </div>
        //                                     </div>
        //                                 </div>`  // Your HTML email content
        //                     };

        // await transporter.sendMail({
        //                                 ...mailOptions,  
        //                             });

        const return_data = {
            status: 200,
            message: "Successfully created.",
            data: data
        };

        res.status(200).json(return_data);
    } catch (error) {
        next(error);
    }
};

const detailsUser = async (req, res, next) => {
    try {
        const data = await UserHelper.detailsUser(req.params.id, req.params.type);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const editUser = async (req, res, next) => {
    try {
        const data = await UserHelper.editUser(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const updateUser = async (req, res, next) => {
    try {
        // Strip internal auth/verification fields — these must not be freely settable via API
        const { otp, otpExpires, isVerified, ...safeBody } = req.body;
        const data = await UserHelper.updateUser(req.params.id, safeBody);
        res.status(200).json({ status: 200, message: "Successfully updated.", data });
    } catch (error) {
        next(error);
    }
};

const checkUserExists = async (req, res, next) => {
    try {
        const { email, whatsapp_no, excludeUserId } = req.query;
        const data = await UserHelper.checkUserExists({ email, whatsapp_no, excludeUserId });
        res.status(200).json({ status: 200, message: "Successfully checked.", data });
    } catch (error) {
        next(error);
    }
};

const listUser = async (req, res, next) => {
    try {
        const { orgId, user_type, orgRole } = req.query;
        const data = await UserHelper.listUser({ orgId, user_type, orgRole });
        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const listUserPagination = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const filters = {};
        if (req.query.user_type) filters.user_type = req.query.user_type;
        if (req.query.search) filters.search = req.query.search;
        if (req.query.orgId) filters.orgId = req.query.orgId;
        if (req.query.orgRole) filters.orgRole = req.query.orgRole;

        const countQuery = { deletedAt: null };
        if (filters.user_type) countQuery.user_type = filters.user_type;
        if (filters.search) {
            countQuery.$or = [
                { name:  { $regex: filters.search, $options: 'i' } },
                { email: { $regex: filters.search, $options: 'i' } },
            ];
        }
        // Same org filter as the list itself (an invalid id used to reach the
        // count query raw and fail the whole request with a 500).
        const orgFilter = UserHelper.orgIdFilter(filters.orgId);
        if (orgFilter !== undefined) countQuery.orgId = orgFilter;
        if (filters.orgRole) countQuery.orgRole = filters.orgRole;

        const [users, totalUsers] = await Promise.all([
            UserHelper.listUserPagination(page, limit, filters),
            User.countDocuments(countQuery),
        ]);
        const totalPages = Math.ceil(totalUsers / limit);

        res.status(200).json({
            status: 200,
            message: "Successfully fetched.",
            data: users,
            total: totalUsers,
            totalPages,
            currentPage: page
        });
    } catch (error) {
        next(error);
    }
};

const exportUsers = async (req, res, next) => {
    try {
        const filters = {};
        if (req.query.user_type) filters.user_type = req.query.user_type;
        if (req.query.search) filters.search = req.query.search;

        const users = await UserHelper.listUserForExport(filters);

        // Batch-fetch permissions for every distinct role in a single query instead of
        // one getPermissionsByRole() lookup per user (N+1) — was O(n) queries for n users.
        const roleIds = [...new Set(
            users.map(u => u.user_role?._id).filter(Boolean).map(id => id.toString())
        )];

        const rolePermissions = roleIds.length
            ? await RolePermission.find({ role_id: { $in: roleIds } })
                .populate({ path: 'permission_id', select: '_id name display_name' })
                .lean()
            : [];

        const permissionsByRole = new Map();
        for (const rp of rolePermissions) {
            const key = rp.role_id.toString();
            const label = rp.permission_id?.display_name || rp.permission_id?.name;
            if (!label) continue;
            if (!permissionsByRole.has(key)) permissionsByRole.set(key, []);
            permissionsByRole.get(key).push(label);
        }

        const data = users.map((user) => ({
            ...user,
            permissions: user.user_role?._id
                ? (permissionsByRole.get(user.user_role._id.toString()) || [])
                : [],
        }));

        res.status(200).json({ status: 200, message: "Successfully fetched.", data });
    } catch (error) {
        next(error);
    }
};

const deleteUser = async (req, res, next) => {
    try {
        const data = await UserHelper.deleteUser(req.params.id);
        res.status(200).json({ status: 200, message: "Successfully deleted.", data });
    } catch (error) {
        next(error);
    }
};

const registerUser = async (req, res, next) => {
    try {
        const data = await UserHelper.registerUser(req.body);
        res.status(200).json(data);
    } catch (err) {
        next(err);
    }
};

// How long a "Log in" (as a store owner or learner) session lasts; the tab's 30-minute idle logout still applies.
const IMPERSONATION_EXPIRES_IN = '2h';

/** Who to log in as: { orgId } → that organization's store owner, { userId } → that learner. */
async function impersonationTarget({ orgId, userId }) {
    const db = mongoose.connection.db;
    const fail = (status, message) => ({ error: [status, message] });

    if (userId !== undefined) {
        if (!mongoose.isValidObjectId(userId)) return fail(400, 'A valid learner is required.');
        const learner = await User.findOne({ _id: userId, user_type: 'employee', deletedAt: null }).lean();
        if (!learner) return fail(404, 'Learner not found.');
        const org = learner.orgId
            ? await db.collection('organizations').findOne({ _id: learner.orgId, deletedAt: null }, { projection: { org_name: 1 } })
            : null;
        if (!org) return fail(400, `${learner.name || learner.email} is not assigned to an organization.`);
        if (learner.status && learner.status !== 'active') return fail(400, `${learner.name || learner.email}'s account is not active.`);
        return { user: learner, role: 'learner', org };
    }

    if (!mongoose.isValidObjectId(orgId)) return fail(400, 'A valid organization is required.');
    const org = await db.collection('organizations').findOne(
        { _id: new mongoose.Types.ObjectId(orgId), deletedAt: null },
        { projection: { org_name: 1, ownerId: 1 } },
    );
    if (!org) return fail(404, 'Organization not found.');
    // The owner account: organizations.ownerId, else the org's user with the owner role.
    const ownerQuery = { user_type: 'organization', deletedAt: null };
    const owner = (org.ownerId && await User.findOne({ ...ownerQuery, _id: org.ownerId }).lean())
        || await User.findOne({ ...ownerQuery, orgId: org._id, orgRole: 'owner' }).lean();
    if (!owner) return fail(404, `${org.org_name || 'This organization'} has no store owner account to log in as.`);
    if (owner.status && owner.status !== 'active') return fail(400, `The store owner account of ${org.org_name || 'this organization'} is not active.`);
    return { user: owner, role: 'storeowner', org };
}

// POST /user/admin/impersonate { orgId } | { userId } — super admin only.
// Signs the super admin in as an organization's store owner ({ orgId }) or as a learner
// ({ userId }) in a separate browser tab. The token carries impersonatedBy, so it isn't
// counted as that user's own login or activity, and every use is written to the server log.
const impersonateUser = async (req, res, next) => {
    try {
        const { user, role, org, error } = await impersonationTarget(req.body || {});
        if (error) return res.status(error[0]).json({ status: error[0], message: error[1] });

        const secret = jwt.sign(
            { _id: user._id, email: user.email, user_type: user.user_type, impersonatedBy: req.user._id },
            process.env.JWT_SECRET,
            { expiresIn: IMPERSONATION_EXPIRES_IN },
        );
        console.info(`[impersonate] super admin ${req.user._id} (${req.user.email}) logged in as ${role} ${user._id} (${user.email}) of org ${org._id}`);
        const name = role === 'learner' ? (user.name || user.email) : (org.org_name || 'the store owner');
        res.status(200).json({
            status: 200,
            message: `Logged in as ${name}.`,
            data: {
                _id: user._id, name: user.name, email: user.email, user_type: user.user_type,
                orgId: user.orgId, orgRole: user.orgRole, status: user.status, secret,
                impersonation: { role, name: user.name || user.email || '', orgName: org.org_name || '', by: req.user.email || '' },
            },
        });
    } catch (err) {
        next(err);
    }
};

const loginUser = async (req, res, next) => {
    try {
        // Single fetch reused for both the existence check and the password compare —
        // previously this ran the exact same User.findOne() query twice per request.
        const check_email = await User.findOne({ email: req.body.email, deletedAt: null });
        if (!check_email) {
            return res.status(400).json({ status: 400, message: "Email does not exist." });
        }

        const isMatch = await bcrypt.compare(req.body.password, check_email.password);
        if (!isMatch) {
            return res.status(400).json({ status: 400, message: "Password does not match." });
        }

        const data = await UserHelper.loginUser(req.body);
        res.status(200).json({ status: 200, message: "Successfully logged in.", data });
    } catch (err) {
        next(err);
    }
};

const gmLoginUser = async (req, res, next) => {
    try {
        const data = await UserHelper.gmLoginUser(req.body);
        res.status(200).json({ status: 200, message: "Successfully logged in.", data });
    } catch (err) {
        next(err);
    }
};

const adminLoginUser = async (req, res, next) => {
    try {
        const identifier = req.body.identifier || req.body.email || req.body.phone;
        if (!identifier) {
            return res.status(400).json({ status: 400, message: "Email or phone number is required." });
        }

        const user = await User.findOne({
            $or: [{ email: identifier }, { phone: identifier }],
            deletedAt: null,
        });
        if (!user) {
            return res.status(400).json({ status: 400, message: "User does not exist." });
        }

        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
            return res.status(400).json({ status: 400, message: "Password does not match." });
        }

        const data = await UserHelper.adminLoginUser({ identifier, password: req.body.password });
        res.status(200).json({ status: 200, message: "Successfully logged in.", data });
    } catch (err) {
        next(err);
    }
};

const adminLoginRequestOtp = async (req, res, next) => {
    try {
        // .lean(): the raw record, so a missing status isn't filled in as "active"
        const userDetails = await User.findOne({ email: req.body.email, deletedAt: null }).lean();
        if (!userDetails) {
            return res.status(400).json({ status: 400, message: "Email does not exist." });
        }

        const isMatch = await bcrypt.compare(req.body.password, userDetails.password);
        if (!isMatch) {
            return res.status(400).json({ status: 400, message: "Password does not match." });
        }
        try { UserHelper.assertActiveStatus(userDetails); }
        catch (e) { return res.status(400).json({ status: 400, message: e.message }); }

        const otp = Math.floor(1000 + Math.random() * 9999).toString();
        const payload = {
            otp: otp,
            otpExpires: new Date(Date.now() + 15 * 60 * 1000),
        };
        await UserHelper.updateUser(userDetails._id, payload);

        const requestedChannels = getRequestedOtpChannels(req.body);
        if (!requestedChannels.length) {
            return res.status(400).json({
                status: 400,
                message: 'Select at least one OTP delivery option (email or sms).',
            });
        }

        const deliveryResult = {
            email: 'not-requested',
            sms: 'not-requested',
        };
        const allowSmsSimulation = process.env.NODE_ENV !== 'production';
        let smsDeliveryWarning = null;

        if (requestedChannels.includes('email')) {
            await sendAdminLoginOtpEmail({ otp, email: userDetails.email });
            deliveryResult.email = 'sent';
        }

        if (requestedChannels.includes('sms')) {
            try {
                await sendAdminLoginOtpSms({ otp, phone: userDetails.phone || req.body.phone });
                deliveryResult.sms = 'sent';
            } catch (smsError) {
                if (!allowSmsSimulation) {
                    throw smsError;
                }

                deliveryResult.sms = 'simulated';
                smsDeliveryWarning = smsError?.message || 'SMS delivery is simulated in local mode.';
            }
        }

        const messageParts = [`Successfully sent OTP via ${requestedChannels.join(' and ')}.`];
        if (smsDeliveryWarning) {
            messageParts.push(`SMS fallback (local): ${smsDeliveryWarning}`);
        }

        const return_data = {
            status: 200,
            message: messageParts.join(' '),
            data: {
                mail: deliveryResult.email === 'sent' ? 'send' : 'not-requested',
                sms: deliveryResult.sms === 'sent' ? 'send' : (deliveryResult.sms === 'simulated' ? 'simulated' : 'not-requested'),
                channels: requestedChannels,
                delivery: deliveryResult,
            }
        };

        res.status(200).json(return_data);
    } catch (err) {
        next(err);
    }
};

const adminLoginVerifyOtp = async (req, res, next) => {
    try {
        const userDetails = await User.findOne({ email: req.body.email, user_type: 'superadmin', deletedAt: null }).lean();
        if (!userDetails) {
            return res.status(400).json({ status: 400, message: "Email does not exist." });
        }

        if (!userDetails.otp || userDetails.otp !== String(req.body.otp)) {
            return res.status(400).json({ status: 400, message: "OTP does not match." });
        }

        if (!userDetails.otpExpires || userDetails.otpExpires < Date.now()) {
            return res.status(400).json({ status: 400, message: "OTP has expired." });
        }
        try { UserHelper.assertActiveStatus(userDetails); }
        catch (e) { return res.status(400).json({ status: 400, message: e.message }); }

        const payload = {
            otp: null,
            otpExpires: null,
        };
        await UserHelper.updateUser(userDetails._id, payload);

        const token = generateJwtToken(userDetails);
        UserHelper.markLoggedIn(userDetails._id);
        return res.status(200).json({
            status: 200,
            message: "Successfully verified OTP.",
            data: {
                _id: userDetails._id,
                name: userDetails.name,
                email: userDetails.email,
                user_type: userDetails.user_type,
                status: userDetails.status,
                secret: token,
            }
        });
    } catch (err) {
        next(err);
    }
};

const verifyUserOtp = async (req, res, next) => {
    try {
        const check_otp = await User.findOne({ email: req.body.email, otp: req.body.otp });
        if (!check_otp) {
            return res.status(400).json({ status: 400, message: "OTP does not match." });
        }

        const data = await UserHelper.verifyUserOtp(req.body);
        res.status(200).json(data);
    } catch (err) {
        next(err);
    }
};

const resendUserOtp = async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.status(400).json({ status: 400, message: "Email does not exist." });
        }
        const otp = Math.floor(1000 + Math.random() * 9999);
        const payload = {
            otp: otp,
            otpExpires: new Date(Date.now() + 15 * 60 * 1000),
        };

        await UserHelper.updateUser(user._id, payload);

        await transporter.sendMail({
            to: req.body.email,
            subject: "Your OTP Code to Signup - Womenka Trends Pvt. Ltd.",
            html: `<div class="container" style="max-width: 600px; margin: auto;">
                        <div class="card" style="border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1); border: 2px solid #000; padding: 0px 20px 10px;  background-color: #f8f9fa;">
                        <div class="card-body">

                            <h2 class="text-center text-primary mb-4">OTP Verification</h2>
                            <p class="text-center">Your One-Time Password (OTP) is:</p>
                            <h3 class="text-center" style="font-weight: bold; color: #d9534f;"> ${otp} </h3>
                            <p class="text-center">Please enter this OTP in the application to complete your verification.</p>

                            <hr>
                            <p class="text-center" style="font-size: 14px; color: #6c757d;">
                            If you did not request this OTP, please ignore this email.
                            </p>

                            <hr>
                            <div class="text-center mt-4">
                            <p class="text-muted" style="font-size: 12px;">Powered by Womenka Trends Pvt. Ltd.</p>
                            </div>
                        </div>
                        </div>
                    </div>`,
        });

        const return_data = {
            status: 200,
            message: "Successfully sent OTP.",
            data: {}
        };

        res.status(200).json(return_data);
    } catch (err) {
        next(err);
    }
};

const adminGoogleLogin = async (req, res, next) => {
    try {
        const credential = req.body.credential || req.body.token || req.body.idToken;
        if (!credential) {
            return res.status(400).json({ status: 400, message: 'Google credential is required.' });
        }
        const data = await UserHelper.adminGoogleLoginUser(credential);
        res.status(200).json({ status: 200, message: 'Successfully logged in.', data });
    } catch (err) {
        next(err);
    }
};

const forgotPassword = async (req, res, next) => {
    try {
        const userDetails = await User.findOne({ email: req.body.email, deletedAt: null });
        if (!userDetails) {
            return res.status(400).json({ status: 400, message: "Email does not exist." });
        }

        // Generate a secure random token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Save hashed token + expiry to user
        await User.findByIdAndUpdate(userDetails._id, {
            $set: {
                resetPasswordToken: resetTokenHash,
                resetPasswordExpires: expires,
                updatedAt: new Date(),
            }
        });

        // Build reset link
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        const resetLink = `${clientUrl}/login?token=${resetToken}&type=reset`;

        await transporter.sendMail({
            to: userDetails.email,
            subject: "Password Reset Link - Womenka Trends Pvt. Ltd.",
            html: `<div style="max-width:600px;margin:auto;font-family:sans-serif;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
                        <div style="background:#0b7b7b;padding:24px 32px;">
                            <h2 style="color:#fff;margin:0;font-size:20px;">Password Reset Request</h2>
                        </div>
                        <div style="padding:32px;">
                            <p style="color:#374151;font-size:15px;margin-bottom:8px;">Hi <strong>${userDetails.name}</strong>,</p>
                            <p style="color:#374151;font-size:14px;line-height:1.6;">
                                We received a request to reset the password for your account. Click the button below to set a new password.
                                This link is valid for <strong>15 minutes</strong>.
                            </p>
                            <div style="text-align:center;margin:32px 0;">
                                <a href="${resetLink}" style="background:#0b7b7b;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">
                                    Reset Password
                                </a>
                            </div>
                            <p style="color:#6b7280;font-size:13px;">
                                If you did not request a password reset, please ignore this email. Your password will not change.
                            </p>
                            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
                            <p style="color:#9ca3af;font-size:12px;text-align:center;">Powered by Womenka Trends Pvt. Ltd.</p>
                        </div>
                    </div>`,
        });

        res.status(200).json({
            status: 200,
            message: "Password reset link sent to your email.",
            data: { mail: "sent" }
        });
    } catch (err) {
        next(err);
    }
};

const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword, confirmPassword } = req.body;

        if (!token || !newPassword || !confirmPassword) {
            return res.status(400).json({ status: 400, message: "Token, new password, and confirm password are required." });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ status: 400, message: "Passwords do not match." });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ status: 400, message: "Password must be at least 8 characters." });
        }

        // Hash the incoming token to compare with the stored hash
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: tokenHash,
            resetPasswordExpires: { $gt: new Date() },
            deletedAt: null,
        });

        if (!user) {
            return res.status(400).json({ status: 400, message: "Reset link is invalid or has expired." });
        }

        // Hash new password and clear reset token
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await User.findByIdAndUpdate(user._id, {
            $set: {
                password: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpires: null,
                updatedAt: new Date(),
            }
        });

        res.status(200).json({ status: 200, message: "Password updated successfully." });
    } catch (err) {
        next(err);
    }
};

const updateUserPassword = async (req, res, next) => {
    try {
        const userDetails = await User.findOne({ _id: req.params.id, deletedAt: null });
        if (!userDetails) return res.status(404).json({ status: 404, message: "User does not exist." });
        const isSelf = String(req.user?._id) === String(req.params.id);
        if (!isSelf) {
            const me = await User.findById(req.user?._id).select('user_type orgId orgRole deletedAt').lean();
            const sameOrgAdmin = me && !me.deletedAt && me.orgId && userDetails.orgId
                && String(me.orgId) === String(userDetails.orgId) && ['owner', 'admin'].includes(me.orgRole);
            if (!me || me.deletedAt || (me.user_type !== 'superadmin' && !sameOrgAdmin)) {
                return res.status(403).json({ status: 403, message: "Not allowed to change this user's password." });
            }
        }
        if (typeof req.body.password !== 'string' || req.body.password.length < 6) {
            return res.status(400).json({ status: 400, message: "Password must be at least 6 characters." });
        }
        const payload = {
            password: req.body.password,
        }
        await UserHelper.updateUser(req.params.id, payload);
        res.status(200).json({ status: 200, message: "Successfully updated.", data: userDetails });
    } catch (error) {
        next(error);
    }
};

const generateJwtToken = (user) => {
    return jwt.sign(
        {
            _id: user._id,
            email: user.email,
            name: user.name,
            // Role checks (requireSuperAdmin) read this, as with the other login tokens (user.service.js).
            user_type: user.user_type
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRE
        }
    );
};

const generateRandomPassword = (length = 12) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const getGoogleClientId = (req, res, next) => {
    try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) {
            return res.status(500).json({ status: 500, message: 'Google Client ID is not configured.' });
        }
        res.status(200).json({ status: 200, clientId: clientId });
    } catch (err) {
        next(err);
    }
};

// Route bindings
Router.post('/admin/create', protect, createUser);
Router.get('/admin/check-exists', protect, checkUserExists);
Router.get('/admin/edit/:id', protect, editUser);
Router.get('/admin/details/:id/:type', protect, detailsUser);
Router.put('/admin/update/:id', protect, updateUser);
Router.get('/admin/list', protect, listUser);
Router.get('/admin/delete/:id', protect, deleteUser);
Router.get('/admin/list-pagination', protect, listUserPagination);
Router.get('/admin/export', protect, exportUsers);
Router.post('/register', registerUser);
Router.post('/login', loginUser);
Router.post('/admin/impersonate', protect, requireSuperAdmin, impersonateUser);
Router.post('/gmail-login', gmLoginUser);
Router.post('/google-login', gmLoginUser);
Router.post('/google-signin', gmLoginUser);
Router.post('/google-sign-in', gmLoginUser);

Router.post('/verify-user-otp', verifyUserOtp);
Router.post('/resend-user-otp', resendUserOtp);
Router.post('/forgot-password', forgotPassword);
Router.post('/reset-password', resetPassword);
Router.put('/change-password/:id', protect, updateUserPassword);

Router.post('/admin/login/request-otp', adminLoginRequestOtp);
Router.get('/admin/login/request-otp', (req, res) => {
    res.status(405).json({
        status: 405,
        message: 'Use POST /user/admin/login/request-otp with JSON body (email, password, optional otp_channels: email|sms|both).',
    });
});
Router.post('/admin/login/verifyotp', adminLoginVerifyOtp);
Router.post('/admin/login/google', adminGoogleLogin);
Router.post('/admin/login', adminLoginUser);
Router.get('/google-client-id', getGoogleClientId);

// Export the router
export default Router;
