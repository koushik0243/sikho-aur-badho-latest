import mongoose from 'mongoose';
import { requester, SUPERADMIN, STORE_OWNER, LEARNER } from '../middleware/accountAccess.js';

/**
 * Who may read, change, list and create user accounts (routes in user.controller.js):
 *   super admin — everyone
 *   store owner — themselves and the learners of their own organization
 *   learner     — only themselves
 * Account type, role, organization and team role can only be changed by a super admin.
 */

// Fields only a super admin may set on someone's account.
const PRIVILEGED_FIELDS = ['user_type', 'user_role', 'orgId', 'orgRole', 'deletedAt', 'createdBy', 'managerId'];

const forbidden = res => res.status(403).json({ status: 403, message: 'Your account does not have access to this user.' });

async function targetUser(id) {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return mongoose.connection.db.collection('users').findOne(
    { _id: new mongoose.Types.ObjectId(String(id)) },
    { projection: { user_type: 1, orgId: 1, orgRole: 1 } },
  );
}

// A store owner may manage a learner account that belongs to their organization.
const isOwnLearner = (me, target) => me.user_type === STORE_OWNER && me.orgId
  && target && String(target.orgId || '') === me.orgId && target.user_type === LEARNER;

const run = fn => async (req, res, next) => {
  try { return await fn(req, res, next); } catch (err) { return next(err); }
};

/** Only super admins and store owners (e.g. checking whether an email is taken). */
export const superAdminOrStoreOwner = run(async (req, res, next) => {
  const me = await requester(req);
  return [SUPERADMIN, STORE_OWNER].includes(me?.user_type) ? next() : forbidden(res);
});

/** Reading one account (:id): yourself, or (store owner) your organization's users. */
export const canReadUser = run(async (req, res, next) => {
  const me = await requester(req);
  if (!me) return forbidden(res);
  if (me.user_type === SUPERADMIN || me._id === String(req.params.id)) return next();
  if (me.user_type === STORE_OWNER) {
    const target = await targetUser(req.params.id);
    if (target && me.orgId && String(target.orgId || '') === me.orgId) return next();
  }
  return forbidden(res);
});

/** Changing one account (:id): yourself, or (store owner) your organization's learners. */
export const canUpdateUser = run(async (req, res, next) => {
  const me = await requester(req);
  if (!me) return forbidden(res);
  if (me.user_type === SUPERADMIN) return next();
  const isSelf = me._id === String(req.params.id);
  if (!isSelf && !isOwnLearner(me, await targetUser(req.params.id))) return forbidden(res);
  for (const field of PRIVILEGED_FIELDS) delete req.body?.[field];
  return next();
});

/** Listing accounts: super admin — any; store owner — only their organization; learner — no. */
export const scopeUserList = run(async (req, res, next) => {
  const me = await requester(req);
  if (me?.user_type === SUPERADMIN) return next();
  if (me?.user_type === STORE_OWNER && me.orgId) {
    // Whatever was asked for, only their own organization. Express 5 recomputes req.query
    // from the URL on every read, so a changed copy is pinned on this request instead.
    const scoped = { ...req.query, orgId: me.orgId };
    Object.defineProperty(req, 'query', { value: scoped, writable: true, configurable: true, enumerable: true });
    return next();
  }
  return forbidden(res);
});

/** Creating an account: super admin — any; store owner — a learner in their own organization. */
export const scopeUserCreate = run(async (req, res, next) => {
  const me = await requester(req);
  if (me?.user_type === SUPERADMIN) return next();
  if (me?.user_type === STORE_OWNER && me.orgId) {
    for (const field of PRIVILEGED_FIELDS) delete req.body?.[field];
    Object.assign(req.body, { user_type: LEARNER, orgRole: 'employee', orgId: me.orgId, createdBy: me._id });
    return next();
  }
  return forbidden(res);
});
