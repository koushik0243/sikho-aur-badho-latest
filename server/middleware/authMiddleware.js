import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { trackActiveDay } from '../user_activity/track_active_day.js';
dotenv.config();

const protect = (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {

    try {
      token = req.headers.authorization.split(' ')[1];

      // Decode token and attach user id to request object.
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      trackActiveDay(decoded); // daily active users (reports)
      next();

    } catch (error) {
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

/**
 * Use after `protect`: only super admins may continue (e.g. changing the
 * master lists that every organization's dropdowns use).
 */
export const requireSuperAdmin = async (req, res, next) => {
  const denied = () => res.status(403).json({ status: 403, message: 'Only a super admin can do this.' });
  if (req.user?.user_type === 'superadmin') return next();
  if (req.user?.user_type) return denied();
  // Tokens from the admin OTP login used to carry no user_type: check the account's role.
  try {
    if (!mongoose.isValidObjectId(req.user?._id)) return denied();
    const user = await mongoose.connection.db.collection('users').findOne(
      { _id: new mongoose.Types.ObjectId(String(req.user._id)) }, { projection: { user_type: 1 } },
    );
    return user?.user_type === 'superadmin' ? next() : denied();
  } catch (err) {
    return next(err);
  }
};

export default protect;
