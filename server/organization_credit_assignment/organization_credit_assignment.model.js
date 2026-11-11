import mongoose from "mongoose";
const Schema = mongoose.Schema;

const OrganizationCreditSchema = new Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
  creditId: { type: mongoose.Schema.Types.ObjectId, ref: "Credit", index: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  dueDate: { type: Date, required: false, default: null },
  deletedAt: { type: Date, required: false, default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// buildQuery() in organization_credit_assignment.service.js always filters by
// deletedAt and commonly combines it with orgId or creditId (list/list-pagination
// endpoints) — compound indexes serve those lookups better than the existing
// single-field orgId/creditId indexes alone.
OrganizationCreditSchema.index({ orgId: 1, deletedAt: 1 });
OrganizationCreditSchema.index({ creditId: 1, deletedAt: 1 });

export default mongoose.model("organization_credit_assignments", OrganizationCreditSchema);
