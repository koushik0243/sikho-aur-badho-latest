import mongoose from "mongoose";
const Schema = mongoose.Schema;

const CertificateTemplateSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  desc: { type: String, required: true },
  deletedAt: { type: Date, required: false, default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// buildQuery (certificate_template.service.js) filters on deletedAt + status
// in every list/count/duplicate-check query — slug already has a unique index.
CertificateTemplateSchema.index({ deletedAt: 1, status: 1 });

export default mongoose.model("certificate_template", CertificateTemplateSchema);
