import mongoose from "mongoose";
const Schema = mongoose.Schema;

const CourseCategorySchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  desc: { type: String, default: '' },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'course_category', default: null },
  cat_subcat_image: { type: String, required: false, default: null },
  totalCourses: { type: Number, required: true, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, default: null },
  deletedAt: { type: Date, required: false, default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// listCourseCategory/listCourseCategoryPagination/listAllCategories always filter
// by deletedAt and sort by title -- compound index covers both.
CourseCategorySchema.index({ deletedAt: 1, title: 1 });

export default mongoose.model("course_category", CourseCategorySchema);

