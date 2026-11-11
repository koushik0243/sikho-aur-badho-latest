import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const IndustryTypeSchema = new Schema({
    name:        { type: String, required: true },
    slug:        { type: String, unique: true },
    description: { type: String, default: '' },
    parentId:    { type: Schema.Types.ObjectId, ref: 'IndustryType', default: null },
    status:      { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
    deletedAt:   { type: Date, default: null },
    createdAt:   { type: Date, default: Date.now },
    updatedAt:   { type: Date, default: Date.now },
});

// Supports listIndustryTypes/listIndustryTypesPagination/getIndustryTypeCount,
// which filter by deletedAt (+ optional status) and sort by name.
IndustryTypeSchema.index({ deletedAt: 1, status: 1, name: 1 });

export default mongoose.model('IndustryType', IndustryTypeSchema, 'industry_types');
