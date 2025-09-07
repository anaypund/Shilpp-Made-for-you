
const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "productSchema",
    required: true,
  },
  quantity: { type: Number, default: 1 },
  customizeImage: {
      type: [String],
      required: false,
  },
  customizeText: {
      type: [String],
      required: false,
  },
});

module.exports = mongoose.model("CartItem", cartItemSchema);
