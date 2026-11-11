import mongoose from "mongoose";
const Schema = mongoose.Schema;

const CourseSubCategorySchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true },
  description: { type: String, required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "course_category", required: true },
  cat_subcat_image: { type: String, required: false, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, default: null },
  deletedAt: { type: Date, required: false, default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// listCourseSubCategory/listCourseSubCategoryPagination always filter by deletedAt
// and optionally by categoryId (foreign key) -- compound index covers both.
CourseSubCategorySchema.index({ deletedAt: 1, categoryId: 1 });

export default mongoose.model("course_subcategory", CourseSubCategorySchema);
