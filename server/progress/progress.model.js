import mongoose from 'mongoose';

const progressSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  courseId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  topicId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Topic',  required: true },
  watchedSeconds:  { type: Number, default: 0 },
  durationSeconds: { type: Number, default: 0 },
  percentage:      { type: Number, default: 0, min: 0, max: 100 },
  lastPosition:    { type: Number, default: 0 },
  completed:       { type: Boolean, default: false },
}, { timestamps: true });

progressSchema.index({ userId: 1, topicId: 1 }, { unique: true });
// getCourseProgress() (and org_dashboard's bulk lookup) filters by { userId, courseId }
// — not covered by the unique userId+topicId index above, so add a dedicated compound
// index. No read path filters by courseId alone, so the old single-field courseId
// index was redundant write overhead and has been dropped in favor of this one.
progressSchema.index({ userId: 1, courseId: 1 });

export default mongoose.model('Progress', progressSchema);
