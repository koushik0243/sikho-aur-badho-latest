import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  courseId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Course',  required: true },
  chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
  rating:    { type: Number, min: 1, max: 5, required: true },
  text:      { type: String, required: true, trim: true },
}, { timestamps: true });

// One review per learner per chapter
reviewSchema.index({ userId: 1, chapterId: 1 }, { unique: true });
// listReviews()/getCourseStats() filter by { courseId, chapterId } (and courseId alone
// for the aggregate) — not covered by the userId-prefixed unique index above.
reviewSchema.index({ courseId: 1, chapterId: 1 });

export default mongoose.model('Review', reviewSchema);
