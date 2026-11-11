import mongoose from 'mongoose';

// One record per user per day (India time) on which they used the platform —
// written on their first signed-in request of the day. Powers DAU in reports.
const UserActiveDaySchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  day:      { type: String, required: true }, // 'YYYY-MM-DD', India time
  userType: { type: String, default: null },
}, { timestamps: true });

UserActiveDaySchema.index({ userId: 1, day: 1 }, { unique: true });
UserActiveDaySchema.index({ day: 1 });

export default mongoose.model('UserActiveDay', UserActiveDaySchema, 'user_active_days');
