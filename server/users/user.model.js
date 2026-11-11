import mongoose from "mongoose";
const Schema = mongoose.Schema;
import bcrypt from 'bcryptjs';

const Users = new Schema(
    {
        // user_type: { type: Number, enum: [0, 1, 2, 3], default: 3, required: true, comment: '0 for superadmin, 1 for course creator, 2 for organization and 3 for employee' },
        // user_role: { type: String, required: false, default: null },
        // orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: false, default: null },

        user_type: { type: String, enum: ['superadmin', 'creator', 'organization', 'employee'], default: 'employee', index: true },
        user_role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
        orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
        orgRole: { type: String, enum: ['owner', 'admin', 'manager', 'employee'], default: 'employee', index: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

        // Personal Information
        name: { type: String, required: true },        
        email: { type: String, required: true, unique: true },        
        password: { type: String, required: true },        
        phone: { type: String, required: false, default: null },
        alt_phone: { type: String, required: false, default: null },
        whatsapp_no: { type: String, required: false, default: null },
        course_language: { type: String, required: false, default: null },
        dob: { type: Date, required: false, default: null },        
        gender: { type: String, enum: ['male', 'female', 'other'], default: 'male', required: false },        
        bio: { type: String, required: false, default: null },       
        
        // Work Information
        designation: { type: String, required: false, default: null },        
        department: { type: String, required: false, default: null },
        emp_id: { type: String, required: false, default: null },
        access_start: { type: Date, required: false, default: null },
        
        // Address Information
        address1: { type: String, required: false, default: null },        
        address2: { type: String, required: false, default: null },        
        city: { type: String, required: false, default: null },        
        state: { type: String, required: false, default: null },        
        country: { type: String, required: false, default: null },        
        zipcode: { type: String, required: false, default: null },    
        
        // Social Links
        linkedin: { type: String, required: false, default: null },        
        twitter: { type: String, required: false, default: null },        
        facebook: { type: String, required: false, default: null },        
        instagram: { type: String, required: false, default: null },
        youtube: { type: String, required: false, default: null },

        // Emergency Contact
        emergency_contact_name: { type: String, required: false, default: null },        
        emergency_contact_phone: { type: String, required: false, default: null },       

        // Notification Preferences
        email_welcome_noti: { type: Boolean, default: false },
        course_assign_noti: { type: Boolean, default: false },
        weekly_progress_noti: { type: Boolean, default: false },
        live_session_noti: { type: Boolean, default: false },
        language_change_noti: { type: Boolean, default: false },
        
        // Other fields        
        other_info: { type: String, required: false, default: null },        
        otp: { type: String, required: false, default: null },        
        otpExpires: { type: Date, required: false, default: null },        
        resetPasswordToken: { type: String, required: false, default: null },
        resetPasswordExpires: { type: Date, required: false, default: null },
        isVerified: { type: Boolean, default: false },        
        lastLoginAt: { type: Date, default: null }, // set on each successful sign-in
        deletedAt: { type: Date, default: null },        
        status: { type: String, enum: ['active', 'inactive', 'suspended', 'deleted'], default: 'active', required: true },        
    },
    // Mongoose-managed timestamps: on create createdAt and updatedAt get the
    // same moment; every update (save, updateOne, findOneAndUpdate, …) moves
    // updatedAt; createdAt is immutable, so an update can never change it.
    { timestamps: true }
);

// Matches the exact filter shape used by listUser/listUserPagination (org-scoped
// role lookups — e.g. "this org's owner/admins/employees") so those queries hit an
// index instead of scanning the whole collection.
Users.index({ orgId: 1, user_type: 1, orgRole: 1 });

// Password hash middleware
Users.pre('save', async function () {
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Password verification method
Users.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

Users.set('toJSON', {
    transform: function (doc, ret, options) {
        delete ret.password;
        return ret;
    }
});

export default mongoose.model('User', Users);

