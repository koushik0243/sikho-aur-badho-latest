import mongoose from "mongoose";
const Schema = mongoose.Schema;

const SubscriptionSchema = new Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
  status: { type: String, enum: ["active", "canceled", "expired"], default: "active" },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: false, default: null },
  trialEndDate: { type: Date, required: false, default: null },
  autoRenew: { type: Boolean, default: true },
  currentPeriodStart: { type: Date, required: false, default: null },
  currentPeriodEnd: { type: Date, required: false, default: null },
  cancelAt: { type: Date, required: false, default: null },
  canceledAt: { type: Date, required: false, default: null },
  paymentProvider: { type: String, required: false, default: null },
  deletedAt: { type: Date, required: false, default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Every list/pagination query filters by deletedAt and sorts by createdAt (see listSubscription,
// listSubscriptionPagination in subscription.service.js).
SubscriptionSchema.index({ deletedAt: 1, createdAt: -1 });
// organizationId / planId / status are used as optional equality filters in buildQuery().
SubscriptionSchema.index({ organizationId: 1 });
SubscriptionSchema.index({ planId: 1 });
SubscriptionSchema.index({ status: 1 });

export default mongoose.model("Subscription", SubscriptionSchema);

