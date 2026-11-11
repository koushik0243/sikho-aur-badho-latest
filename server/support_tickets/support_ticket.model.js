import mongoose from "mongoose";
const Schema = mongoose.Schema;

const TicketSchema = new Schema({
  orgId:        { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  ticket_id:    { type: String },
  issue_type:   { type: String, required: true },
  subject:      { type: String, required: true },
  desc:         { type: String, required: true },
  priority:     { type: String, required: true },
  resolve_text: { type: String, default: '' },
  deletedAt:    { type: Date, required: false, default: null },
  status: {
    type: String,
    enum: ['open', 'close', 'in_progress', 'resolved', 'not_possible', 'deleted'],
    default: 'open'
  },
  logs: [{
    _id:       false,
    date:      { type: Date,   default: Date.now },
    adminId:   { type: Schema.Types.ObjectId, ref: 'Users' },
    adminName: { type: String, default: '' },
    comment:   { type: String, default: '' },
    status:    { type: String, default: '' },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// listTickets filters by deletedAt (always) + optional status/orgId, and sorts by createdAt.
TicketSchema.index({ deletedAt: 1, createdAt: -1 });
TicketSchema.index({ orgId: 1 });
TicketSchema.index({ status: 1 });

export default mongoose.model("support_tickets", TicketSchema);
