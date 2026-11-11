import mongoose from "mongoose";

const Schema = mongoose.Schema;

const RolePermission = new Schema({
    role_id: { type: Schema.Types.ObjectId, ref: 'Role', required: true },    
    permission_id: { type: Schema.Types.ObjectId, ref: 'Permission', required: true },    
});

RolePermission.index({ role_id: 1, permission_id: 1 }, { unique: true });

export default mongoose.model('Role_Permission', RolePermission);

