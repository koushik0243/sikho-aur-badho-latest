import mongoose from 'mongoose';

/**
 * Which account types may use an API.
 *
 * The app has three accounts: 'superadmin', 'organization' (store owner and their team) and
 * 'employee' (learner). Each API router is mounted with a policy (see app.js):
 *
 *   allowAccounts({ read: [...], write: [...], routes: { 'POST /create': [...] } })
 *
 *   read   — account types allowed to read (GET) from this router
 *   write  — account types allowed to change data (POST/PUT/PATCH/DELETE, and the
 *            GET /delete/:id routes); defaults to super admin only
 *   routes — exceptions for single routes, keyed "METHOD /first-segment"
 *
 * A request from any other account type gets 403. Use after `protect`.
 */

export const SUPERADMIN = 'superadmin';
export const STORE_OWNER = 'organization';
export const LEARNER = 'employee';
export const ALL_ACCOUNTS = [SUPERADMIN, STORE_OWNER, LEARNER];

const usersCollection = () => mongoose.connection.db.collection('users');

/**
 * The signed-in account (user_type, orgId, orgRole, status), loaded once per request.
 * Tokens from the old admin OTP login carried no user_type, so the database is the source.
 * @returns {Promise<{ _id: string, user_type: string|null, orgId: string|null, orgRole: string|null } | null>}
 */
export async function requester(req) {
  if (req.account !== undefined) return req.account;
  const id = req.user?._id;
  if (!id || !mongoose.isValidObjectId(id)) { req.account = null; return null; }
  const doc = await usersCollection().findOne(
    { _id: new mongoose.Types.ObjectId(String(id)), deletedAt: null },
    { projection: { user_type: 1, orgId: 1, orgRole: 1, status: 1 } },
  );
  req.account = doc
    ? { _id: String(doc._id), user_type: doc.user_type || null, orgId: doc.orgId ? String(doc.orgId) : null, orgRole: doc.orgRole || null }
    : null;
  return req.account;
}

const isChange = req => !['GET', 'HEAD', 'OPTIONS'].includes(req.method) || /^\/delete(\/|$)/.test(req.path);
const routeKey = req => `${req.method} /${req.path.split('/').filter(Boolean)[0] || ''}`;

function forbidden(res) {
  return res.status(403).json({ status: 403, message: 'Your account does not have access to this.' });
}

/** Router-level policy; see the comment at the top of this file. */
export function allowAccounts({ read, write = [SUPERADMIN], routes = {} }) {
  return async (req, res, next) => {
    try {
      const me = await requester(req);
      if (!me?.user_type) return forbidden(res);
      const allowed = routes[routeKey(req)] || (isChange(req) ? write : read);
      return allowed.includes(me.user_type) ? next() : forbidden(res);
    } catch (err) {
      return next(err);
    }
  };
}
