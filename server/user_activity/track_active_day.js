import mongoose from 'mongoose';
import UserActiveDay from './user_active_day.model.js';

const dayKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

// Users already recorded today, so each user costs at most one write per day.
let seenDay = '';
const seen = new Set();

/**
 * Records that the signed-in user (decoded JWT) was active today. Fire-and-forget:
 * never delays or fails the request it is called from.
 * @param {{ _id?: string, user_type?: string }} user
 */
export function trackActiveDay(user) {
  const uid = user?._id ? String(user._id) : '';
  if (!mongoose.isValidObjectId(uid)) return;
  if (user.impersonatedBy) return; // a super admin logged in as a store owner — not that user's own activity
  const day = dayKey(new Date());
  if (day !== seenDay) { seenDay = day; seen.clear(); }
  if (seen.has(uid)) return;
  seen.add(uid);
  const userId = new mongoose.Types.ObjectId(uid);
  UserActiveDay.updateOne(
    { userId, day },
    { $setOnInsert: { userId, day, userType: user.user_type || null } },
    { upsert: true },
  ).catch(error => {
    seen.delete(uid); // try again on the next request
    console.error('trackActiveDay failed:', error.message);
  });
}
