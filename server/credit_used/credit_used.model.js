import mongoose from "mongoose";
const Schema = mongoose.Schema;

const CreditUsedSchema = new Schema(
  {
    orgId:     { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    learnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    courseId:  { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
    deletedAt: { type: Date, default: null },
    status:    { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

// listCreditUsed/listCreditUsedPagination always sort by createdAt desc, and buildQuery
// optionally filters by deletedAt + orgId / learnerId / courseId (foreign keys with no prior index).
CreditUsedSchema.index({ deletedAt: 1, createdAt: -1 });
CreditUsedSchema.index({ orgId: 1, deletedAt: 1 });
CreditUsedSchema.index({ learnerId: 1, deletedAt: 1 });
CreditUsedSchema.index({ courseId: 1, deletedAt: 1 });

export default mongoose.model("credit_used", CreditUsedSchema);
