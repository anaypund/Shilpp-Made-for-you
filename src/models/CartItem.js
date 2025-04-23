// models/CartItem.js
const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  userId: { type: Number, required: true }, // Assuming you have a User model
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'productSchema', required: true },
  quantity: { type: Number, default: 1 },
});

module.exports = mongoose.model('CartItem', cartItemSchema);
