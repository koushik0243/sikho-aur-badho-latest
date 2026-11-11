import mongoose from 'mongoose';
import Organization from './organization.model.js';

const { ObjectId } = mongoose.Types;

const buildQuery = (filters = {}) => {
    const query = { deletedAt: null };
    if (filters.status) query.status = filters.status;
    if (filters.ownerId && ObjectId.isValid(filters.ownerId)) {
        query.ownerId = new ObjectId(filters.ownerId);
    }
    if (filters.search) {
        query.org_name = { $regex: filters.search, $options: 'i' };
    }
    return query;
};

const populateRefs = (query) =>
    query
        .populate('ownerId', '_id name email phone whatsapp_no')
        .populate('industryTypeIds', '_id name');

export const checkOrganizationName = async (name, excludeId = null) => {
    try {
        const query = { org_name: { $regex: new RegExp(`^${name}$`, 'i') }, deletedAt: null };
        if (excludeId) query._id = { $ne: excludeId };
        return await Organization.findOne(query).select('_id org_name').lean();
    } catch (error) {
        throw error;
    }
};

export const createOrganization = async (data = {}) => {
    try {
        return await new Organization({
            ownerId: (data.ownerId && ObjectId.isValid(data.ownerId)) ? data.ownerId : null,
            org_name: data.org_name || null,
            org_desc: data.org_desc || null,
            org_logo: data.org_logo || null,
            org_email: data.org_email || null,
            org_phone: data.org_phone || null,
            org_address1: data.org_address1 || null,
            org_address2: data.org_address2 || null,
            org_city: data.org_city || null,
            org_state: data.org_state || null,
            org_country: data.org_country || null,
            org_zipcode: data.org_zipcode || null,
            org_website: data.org_website || null,
            hr_manager_email: data.hr_manager_email || null,
            hr_manager_no: data.hr_manager_no || null,
            industry: data.industry || null,
            industryTypeIds: Array.isArray(data.industryTypeIds) ? data.industryTypeIds.filter(id => ObjectId.isValid(id)) : [],
            course_ids: Array.isArray(data.course_ids) ? data.course_ids.filter(id => ObjectId.isValid(id)) : [],
            emp_count: data.emp_count || null,
            email_digest: data.email_digest ?? false,
            credit_alert: data.credit_alert ?? false,
            zoom_reminder: data.zoom_reminder ?? false,
            cert_issue_alert: data.cert_issue_alert ?? false,
            status: data.status || 'active'
        }).save();
    } catch (error) {
        throw error;
    }
};

export const editOrganization = async (editId) => {
    try {
        return await populateRefs(
            Organization.findOne({ _id: editId, deletedAt: null })
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const updateOrganization = async (updateId, data) => {
    try {
        const fields = [
            'ownerId', 'org_name', 'org_desc', 'org_logo', 'org_email', 'org_phone',
            'org_address1', 'org_address2', 'org_city', 'org_state', 'org_country', 'org_zipcode',
            'org_website', 'hr_manager_email', 'hr_manager_no',
            'industry', 'industryTypeIds', 'course_ids', 'emp_count',
            'email_digest', 'credit_alert', 'zoom_reminder', 'cert_issue_alert',
            'status'
        ];
        const updateFields = {};
        for (const field of fields) {
            if (data[field] !== undefined) {
                if (field === 'ownerId') {
                    updateFields[field] = (data[field] && ObjectId.isValid(data[field])) ? data[field] : null;
                } else if (field === 'industryTypeIds' || field === 'course_ids') {
                    updateFields[field] = Array.isArray(data[field]) ? data[field].filter(id => ObjectId.isValid(id)) : [];
                } else {
                    updateFields[field] = data[field];
                }
            }
        }

        if (Object.keys(updateFields).length === 0) {
            return await populateRefs(
                Organization.findOne({ _id: updateId, deletedAt: null })
            ).lean();
        }

        updateFields.updatedAt = new Date();

        return await Organization.findOneAndUpdate(
            { _id: updateId, deletedAt: null },
            { $set: updateFields },
            { returnDocument: 'before', runValidators: true }
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listOrganization = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await populateRefs(
            Organization.find(query).sort({ createdAt: -1 })
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const listOrganizationPagination = async (page, limit, filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await populateRefs(
            Organization.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
        ).lean();
    } catch (error) {
        throw error;
    }
};

export const getOrganizationCount = async (filters = {}) => {
    try {
        const query = buildQuery(filters);
        return await Organization.countDocuments(query);
    } catch (error) {
        throw error;
    }
};

export const deleteOrganization = async (delId) => {
    try {
        return await Organization.findOneAndUpdate(
            { _id: delId, deletedAt: null },
            { $set: { deletedAt: new Date(), status: 'inactive' } },
            { returnDocument: 'before' }
        );
    } catch (error) {
        throw error;
    }
};
