import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    courseId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Course',  required: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', default: null },
    topicId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Topic',   default: null },
    text:      { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// listNotes always filters by { userId, courseId } and sorts by createdAt desc.
noteSchema.index({ userId: 1, courseId: 1, createdAt: -1 });

export default mongoose.model('Note', noteSchema);
