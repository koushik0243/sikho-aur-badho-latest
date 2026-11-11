import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema({
  questionId:     { type: mongoose.Schema.Types.ObjectId, required: true },
  questionText:   { type: String, required: true },
  originalAnswer: { type: String, default: '' },
  userAnswer:     { type: String, default: '' },
  status:         { type: String, enum: ['answered', 'skipped'], default: 'skipped' },
  maxScore:       { type: Number, required: true },
  aiScore:        { type: Number, default: 0 },
  aiFeedback:     { type: String, default: '' },
}, { _id: false });

const aptitudeAttemptSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  courseId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  answers:     [answerSchema],
  totalScore:  { type: Number, default: 0 },
  level:       { type: String, enum: ['beginner', 'intermediate', 'expert'], default: 'beginner' },
  timeTakenSec: { type: Number, default: null }, // seconds spent on the test (null = not recorded)
  status:      { type: String, enum: ['pending', 'evaluated'], default: 'evaluated' },
  evaluatedAt: { type: Date },
}, { timestamps: true });

// Every read path (listAttempts here, and the merged activity timeline in
// activity_log.service.js) filters by userId and sorts by createdAt desc —
// this compound index covers both in one pass.
aptitudeAttemptSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('aptitude_attempts', aptitudeAttemptSchema);
