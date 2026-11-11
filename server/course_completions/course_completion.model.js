import mongoose from 'mongoose';

// A learner's earned certificate for a course. Written once, the first time the
// learner finishes every chapter, and never removed — so content the admin adds
// to the course later (new chapters/topics) can't take the certificate away.
// chapterIds / topicIds snapshot what the course held at completion: anything
// not listed was added afterwards and is shown inactive to this learner.
const courseCompletionSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  courseId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  completedAt: { type: Date, required: true },
  chapterIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }],
  topicIds:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
}, { timestamps: true });

courseCompletionSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export default mongoose.model('CourseCompletion', courseCompletionSchema, 'course_completions');
