const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  value: { type: Number, required: true },
  expiryDate: { type: Date, required: true },
  count: { type: Number, default: 0 }, // Optional: to track how many times the coupon has been used
  createdAt: { type: Date, default: Date.now },
  maxCount: { type: Number, default: 1 } // Optional: to limit the number of times a coupon can be used

});

const Coupon = mongoose.model('Coupon', CouponSchema);
module.exports = Coupon;
