const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const sellerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  shopName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  // Contact
  phoneNumber: { type: String, required: true, unique: true },
  altNumber: { type: String },

  // Address parts
  country: { type: String, required: true },
  state: { type: String, required: true },
  city: { type: String, required: true },
  address: { type: String, required: true },
  pincode: { type: String, required: true },

  // Process & Policy
  processTime: { type: String, required: true },
  returnPolicy: { type: String, required: true },

  // Payment
  paymentType: { type: String, enum: ['upi', 'bank'], required: true },
  upiId: { type: String },
  bankName: { type: String },
  accountNumber: { type: String },
  ifsc: { type: String },
  passbookName: { type: String },
  branchLocation: { type: String },

  // ID Verification
  personalIdProof: { type: String, required: true }, // file path or GCS URL

  // Social & Branding
  socialMedia: { type: String },
  brandLogo: { type: String }, // file path or GCS URL

  // Story & Experience
  story: { type: String},
  experience: { type: String, required: true },

  // Business Registration
  isBusinessRegistered: { type: String, enum: ['yes', 'no'], required: true },
  businessIdProof: { type: String }, // file path or GCS URL

  createdAt: { type: Date, default: Date.now }
});

sellerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

sellerSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Seller', sellerSchema);
