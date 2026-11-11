import mongoose from 'mongoose';
import Organization from '../organizations/organization.model.js';
import User from '../users/user.model.js';
import IndustryType from '../industry_type/industry_type.model.js';
import * as OrganizationHelper from '../organizations/organization.service.js';

const { ObjectId } = mongoose.Types;

const WHATSAPP_NO_REGEX = /^(\+91[\s-]?)?[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public — no auth required, so nothing here should expose write access to anything
// beyond "create my own organization + owner account". Read-only industry-type list,
// scoped to active/non-deleted entries only (same data an admin sees, nothing sensitive).
export const listIndustryTypesForSignup = async () => {
  return await IndustryType.find({ deletedAt: null, status: 'active' }).sort({ name: 1 }).lean();
};

// Creates an Organization + its owner User in one request, so a dropped connection
// between steps can't leave a half-finished signup behind the way two separate client
// calls could. Validates everything server-side too — this is a PUBLIC endpoint, the
// client-side form validation is not a security boundary.
export const signupOrganization = async (data) => {
  const orgName = String(data.org_name || '').trim();
  const ownerEmail = String(data.owner_email || '').trim().toLowerCase();
  const ownerWhatsapp = String(data.owner_whatsapp || '').trim();
  const ownerPassword = String(data.owner_password || '');

  if (!orgName) {
    const err = new Error('Organization name is required.'); err.statusCode = 400; throw err;
  }
  if (!ownerEmail || !EMAIL_REGEX.test(ownerEmail)) {
    const err = new Error('A valid owner email is required.'); err.statusCode = 400; throw err;
  }
  if (!ownerWhatsapp || !WHATSAPP_NO_REGEX.test(ownerWhatsapp)) {
    const err = new Error('A valid 10-digit WhatsApp number is required (optionally with +91).'); err.statusCode = 400; throw err;
  }
  if (!ownerPassword || ownerPassword.length < 6) {
    const err = new Error('Password must be at least 6 characters.'); err.statusCode = 400; throw err;
  }

  const [dupOrg, dupUser] = await Promise.all([
    Organization.findOne({ org_name: { $regex: new RegExp(`^${orgName}$`, 'i') }, deletedAt: null }).select('_id').lean(),
    User.findOne({ email: ownerEmail, deletedAt: null }).select('_id').lean(),
  ]);
  if (dupOrg) {
    const err = new Error('An organization with this name already exists.'); err.statusCode = 409; throw err;
  }
  if (dupUser) {
    const err = new Error('An account with this email already exists.'); err.statusCode = 409; throw err;
  }

  const industryTypeIds = Array.isArray(data.industryTypeIds)
    ? data.industryTypeIds.filter(id => ObjectId.isValid(id))
    : [];

  const org = await OrganizationHelper.createOrganization({
    org_name: orgName,
    org_logo: data.org_logo || null,
    industryTypeIds,
    status: 'active',
  });

  try {
    const owner = await new User({
      name: ownerEmail,
      email: ownerEmail,
      password: ownerPassword, // hashed by User's pre-save hook
      whatsapp_no: ownerWhatsapp,
      user_type: 'organization',
      orgRole: 'owner',
      orgId: org._id,
      status: 'active',
    }).save();

    await OrganizationHelper.updateOrganization(org._id, { ownerId: owner._id });

    return { organizationId: org._id, userId: owner._id };
  } catch (error) {
    // The owner account failed to create — don't leave an ownerless org behind.
    await Organization.findByIdAndUpdate(org._id, { $set: { deletedAt: new Date(), status: 'inactive' } }).catch(() => {});
    throw error;
  }
};
