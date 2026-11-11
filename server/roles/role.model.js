import mongoose from "mongoose";

const Schema = mongoose.Schema;

const Role = new Schema({
    name: { type: String, required: true, trim: true },
    display_name: { type: String, required: true, trim: true },
    desc: { type: String, default: "" },
    user_type: { type: String, enum: ['superadmin', 'organization'], default: 'superadmin' },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    deletedAt: { type: Date, default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Unique name per scope — null organizationId = superadmin scope
Role.index({ name: 1, organizationId: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });

// listRole/listRolePagination always filter by deletedAt (+ optional status/user_type)
// and sort by display_name/name — compound index covers both shapes.
Role.index({ deletedAt: 1, status: 1, user_type: 1 });
Role.index({ deletedAt: 1, display_name: 1, name: 1 });

export default mongoose.model('Role', Role);

