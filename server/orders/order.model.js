import mongoose from "mongoose";
const Schema = mongoose.Schema;

const OrderSchema = new Schema({
  organizer_id:    { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  credit_id:       { type: Schema.Types.ObjectId, ref: 'Credit', required: true },
  credit_amount:   { type: Number, required: true, default: 0 },
  purchase_date:   { type: Date, default: Date.now },
  payment_gateway: { type: String, default: 'manual' },
  deletedAt:       { type: Date, default: null },
  status:          { type: String, enum: ['success', 'failed', 'pending', 'canceled', 'refunded'], default: 'pending' },
  createdAt:       { type: Date, default: Date.now },
  updatedAt:       { type: Date, default: Date.now },
});

// listOrder/listOrderPagination always filter by deletedAt and sort by createdAt desc,
// and buildQuery optionally filters by organizer_id / credit_id (foreign keys with no prior index).
OrderSchema.index({ deletedAt: 1, createdAt: -1 });
OrderSchema.index({ organizer_id: 1, deletedAt: 1 });
OrderSchema.index({ credit_id: 1, deletedAt: 1 });

export default mongoose.model("Order", OrderSchema);
