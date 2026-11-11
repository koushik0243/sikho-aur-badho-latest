import mongoose from 'mongoose';
const Schema = mongoose.Schema;

// Master list of payment methods (Card, UPI, Net Banking, …), managed by the
// super admin under Payments → Manage Payment Method. An invoice stores the
// method's slug (e.g. 'upi'), which never changes after the method is created,
// so renaming a method never breaks the invoices that use it.
const PaymentMethodSchema = new Schema({
    name:        { type: String, required: true, trim: true },
    slug:        { type: String, unique: true },
    description: { type: String, default: '' },
    status:      { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
    deletedAt:   { type: Date, default: null },
    createdAt:   { type: Date, default: Date.now },
    updatedAt:   { type: Date, default: Date.now },
});

// Supports listPaymentMethods/listPaymentMethodsPagination/getPaymentMethodCount,
// which filter by deletedAt (+ optional status) and sort by name.
PaymentMethodSchema.index({ deletedAt: 1, status: 1, name: 1 });

export default mongoose.model('PaymentMethod', PaymentMethodSchema, 'payment_methods');
