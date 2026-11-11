import mongoose from "mongoose";
const Schema = mongoose.Schema;

const OrganizationCourseSchema = new Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", index: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  dueDate: { type: Date, required: false, default: null },
  deletedAt: { type: Date, required: false, default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// buildQuery() in organization_course_assignment.service.js always filters by
// deletedAt and commonly combines it with orgId or courseId (list/list-pagination
// endpoints) — compound indexes serve those lookups better than the existing
// single-field orgId/courseId indexes alone.
OrganizationCourseSchema.index({ orgId: 1, deletedAt: 1 });
OrganizationCourseSchema.index({ courseId: 1, deletedAt: 1 });

export default mongoose.model("organization_course_assignments", OrganizationCourseSchema);
