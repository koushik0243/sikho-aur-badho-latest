import mongoose from 'mongoose';
const Schema = mongoose.Schema;

// Master list of departments (Engineering, Sales, …), managed by the super
// admin under Organizations → Manage Department.
const DepartmentSchema = new Schema({
    name:        { type: String, required: true, trim: true },
    slug:        { type: String, unique: true },
    description: { type: String, default: '' },
    status:      { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
    deletedAt:   { type: Date, default: null },
    createdAt:   { type: Date, default: Date.now },
    updatedAt:   { type: Date, default: Date.now },
});

// Supports listDepartments/listDepartmentsPagination/getDepartmentCount,
// which filter by deletedAt (+ optional status) and sort by name.
DepartmentSchema.index({ deletedAt: 1, status: 1, name: 1 });

export default mongoose.model('Department', DepartmentSchema, 'departments');
