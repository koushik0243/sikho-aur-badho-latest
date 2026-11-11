import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema({
  questionId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  questionText: { type: String, required: true },
  userAnswer:   { type: String, default: '' },
  status:       { type: String, enum: ['answered', 'skipped'], default: 'skipped' },
  maxScore:     { type: Number, required: true },
  aiScore:      { type: Number, default: 0 },
  aiFeedback:   { type: String, default: '' },
}, { _id: false });

const quizAttemptSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  topicId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Topic',   required: true },
  courseId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Course', index: true },
  chapterId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
  answers:     [answerSchema],
  totalScore:  { type: Number, default: 0 },
  passed:      { type: Boolean, default: false },
  passingGrade: { type: Number }, // the quiz's pass mark (%) when this attempt was marked
  timeTakenSec: { type: Number, default: null }, // seconds spent on the attempt (null = not recorded)
  status:      { type: String, enum: ['pending', 'evaluated'], default: 'evaluated' },
  evaluatedAt: { type: Date },
}, { timestamps: true });

// Matches getAttemptHistory's exact filter shape (this learner's attempts on this quiz).
quizAttemptSchema.index({ userId: 1, topicId: 1 });
// Matches getAttemptsByCourse's filter shape ({ userId, courseId[, chapterId] });
// the existing single-field courseId index doesn't cover the userId prefix.
quizAttemptSchema.index({ userId: 1, courseId: 1 });

export default mongoose.model('QuizAttempt', quizAttemptSchema, 'quiz_attempts');
