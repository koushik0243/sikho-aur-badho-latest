import mongoose from "mongoose";
const Schema = mongoose.Schema;

const OrganizationCourseSchema = new Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
  coursePriceId: { type: mongoose.Schema.Types.ObjectId, ref: "course_pricings", required: false, default: null },
  startDate: { type: Date, required: false },
  endDate: { type: Date, required: false },
  deletedAt: { type: Date, required: false, default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// listOrganizationCourse/listOrganizationCoursePagination filter by orgId+deletedAt
// (org_dashboard's per-org lookup) and sort by createdAt -- compound index covers both.
OrganizationCourseSchema.index({ orgId: 1, deletedAt: 1, createdAt: -1 });

export default mongoose.model("organization_courses", OrganizationCourseSchema);
