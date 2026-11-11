import mongoose from "mongoose";
const Schema = mongoose.Schema;

const PlanSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  desc: { type: String, required: true },
  price: { type: Number, required: true },
  billingCycle: { type: String,  enum: ["monthly", "quarterly", "yearly"],  default: "monthly" },
  maxUsers: { type: Number, required: false, default: 0 },
  maxCourses: { type: Number, required: false, default: 0 },
  storageLimit: { type: Number, required: false, default: 0 }, 
  certificates: { type: Boolean, default: true },
  analytics: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  deletedAt: { type: Date, required: false, default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// listPlan sorts by price+title and listPlanPagination sorts by createdAt; buildQuery
// filters by deletedAt/status/billingCycle — cover both query shapes with indexes.
PlanSchema.index({ deletedAt: 1, status: 1, billingCycle: 1 });
PlanSchema.index({ deletedAt: 1, createdAt: -1 });

export default mongoose.model("Plan", PlanSchema);

