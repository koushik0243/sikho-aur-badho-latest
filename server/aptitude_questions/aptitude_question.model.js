import mongoose from "mongoose";
const Schema = mongoose.Schema;

const AptitudeQuestionSchema = new Schema(
  {
    courseId:    { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: false, default: null },
    question:    { type: String, required: true },
    answer:      { type: String, default: '' },
    difficulty:  { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
    explanation: { type: String, default: '' },
    batchNumber: { type: Number, default: 1 },
    // How the question came to exist: 'generated' by AI, or 'created' by hand
    // by a super admin in the course builder. (Removal is tracked by deletedAt.)
    status:      { type: String, enum: ['generated', 'created'], default: 'generated' },
    deletedAt:   { type: Date, default: null },
  },
  { timestamps: true }
);

// listQuestions (aptitude_question.service.js) always filters on deletedAt +
// status via buildQuery, and courseId is required by the /list endpoint —
// this compound index covers the hot lookup path.
AptitudeQuestionSchema.index({ courseId: 1, deletedAt: 1 });

export default mongoose.model("aptitude_questions", AptitudeQuestionSchema);
