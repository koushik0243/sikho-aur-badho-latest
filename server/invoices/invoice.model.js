import mongoose from "mongoose";
const Schema = mongoose.Schema;

const InvoiceSchema = new Schema({
  org_id:          { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  order_id:        { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  invoice_no:      { type: String, unique: true, sparse: true },

  currency:        { type: String, default: 'INR' },
  sub_total:       { type: Number, default: 0 },
  discount:        { type: Number, default: 0 },
  tax:             { type: Number, default: 0 },
  total_amount:    { type: Number, default: 0 },

  payment_status:  { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  payment_method:  { type: String, default: null },
  transaction_id:  { type: String, default: null },
  payment_date:    { type: Date, default: null },

  bill_name:       { type: String, default: null },
  bill_email:      { type: String, default: null },
  bill_phone:      { type: String, default: null },
  bill_addr:       { type: String, default: null },
  bill_city:       { type: String, default: null },
  bill_state:      { type: String, default: null },
  bill_country:    { type: String, default: null },
  bill_pincode:    { type: String, default: null },
  bill_gst_no:     { type: String, default: null },

  ship_name:       { type: String, default: null },
  ship_email:      { type: String, default: null },
  ship_phone:      { type: String, default: null },
  ship_addr:       { type: String, default: null },
  ship_city:       { type: String, default: null },
  ship_state:      { type: String, default: null },
  ship_country:    { type: String, default: null },
  ship_pincode:    { type: String, default: null },
  ship_gst_no:     { type: String, default: null },

  deletedAt:       { type: Date, default: null },
  status:          { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt:       { type: Date, default: Date.now },
  updatedAt:       { type: Date, default: Date.now },
});

// listInvoice/listInvoicePagination always filter by deletedAt and sort by createdAt desc,
// and buildQuery optionally filters by org_id / order_id (foreign keys with no prior index).
InvoiceSchema.index({ deletedAt: 1, createdAt: -1 });
InvoiceSchema.index({ org_id: 1, deletedAt: 1 });
InvoiceSchema.index({ order_id: 1, deletedAt: 1 });

const InvoiceModel = mongoose.model("Invoice", InvoiceSchema);

// Drop the stale invoiceNumber_1 index left over from the previous schema.
// Runs once after the MongoDB connection is ready; silently ignored if already gone.
mongoose.connection.once('open', () => {
    InvoiceModel.collection.dropIndex('invoiceNumber_1').catch(() => {});
});

export default InvoiceModel;
