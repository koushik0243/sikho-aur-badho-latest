import mongoose from "mongoose";
const Schema = mongoose.Schema;

const TagSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  desc: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, default: null },
  deletedAt: { type: Date, required: false, default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// listTags/listTagsPagination always filter by deletedAt, optionally by status,
// and sort by createdAt (pagination) — slug already has a unique index above.
TagSchema.index({ deletedAt: 1, status: 1 });
TagSchema.index({ deletedAt: 1, createdAt: -1 });

export default mongoose.model("tag", TagSchema);
