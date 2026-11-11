import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const CoursePricingSchema = new Schema({
    courseId:        { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    quantity:        { type: Number, required: true, default: 1 },
    mrp_price:       { type: mongoose.Schema.Types.Decimal128, default: () => mongoose.Types.Decimal128.fromString("0.00") },
    price:           { type: mongoose.Schema.Types.Decimal128, required: true, default: () => mongoose.Types.Decimal128.fromString("0.00") },
    isDefault:       { type: Boolean, default: false },
    status:          { type: String, enum: ['active', 'inactive'], default: 'active' },
    deletedAt:       { type: Date, default: null },
    createdAt:       { type: Date, default: Date.now },
    updatedAt:       { type: Date, default: Date.now },
});

// listCoursePricing/listCoursePricingPagination (course_pricing.service.js) always
// filter by deletedAt, optionally by courseId, and sort by isDefault desc then
// quantity asc -- compound index covers the filter + sort combination.
CoursePricingSchema.index({ deletedAt: 1, courseId: 1, isDefault: -1, quantity: 1 });

export default mongoose.model('course_pricings', CoursePricingSchema);
