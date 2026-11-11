import mongoose from "mongoose";
const Schema = mongoose.Schema;

const CreditSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  limit_from: { type: Number, required: true, default: 0 },
  limit_to: { type: Number, required: true, default: 0 },
  price: { type: mongoose.Schema.Types.Decimal128, required: true, default: () => mongoose.Types.Decimal128.fromString("0.00") },
  desc: { type: String, required: false,  default: null  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, default: null },  
  deletedAt: { type: Date, required: false, default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// listCredit sorts by limit_to and listCreditPagination sorts by createdAt; buildQuery
// filters by deletedAt/status — cover both query shapes with indexes.
CreditSchema.index({ deletedAt: 1, status: 1 });
CreditSchema.index({ deletedAt: 1, createdAt: -1 });

export default mongoose.model("Credit", CreditSchema);

