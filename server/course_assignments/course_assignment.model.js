import mongoose from "mongoose";
const Schema = mongoose.Schema;

const CourseAssignmentSchema = new Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic", index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", index: true },
  answers: Object,
  score: { type: Number, default: 0 },
  passed: { type: Boolean, default: false },
  attemptedAt: { type: Date, default: Date.now }
});

// listCourseAssignment/listCourseAssignmentPagination (course_assignment.service.js)
// support filtering by userId and courseId together (e.g. checking a learner's
// assignment status for a specific course) — userId/courseId already each have
// a single-field index above; this compound index covers the combined lookup.
CourseAssignmentSchema.index({ userId: 1, courseId: 1 });

export default mongoose.model("course_assignments", CourseAssignmentSchema);
