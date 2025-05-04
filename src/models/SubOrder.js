
const mongoose = require('mongoose');

const subOrderSchema = new mongoose.Schema({
  mainOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'productSchema',
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      required: true
    }
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  deadline: {
    type: Date,
    required: true
  },
  shippingStatus: {
    type: String,
    enum: ['pending', 'shipped-to-admin', 'delivered-to-admin', 'shipped-to-customer', 'delivered-to-customer'],
    default: 'pending'
  },
  shippedAt: {
    type: Date
  },
  deliveredToAdminAt: {
    type: Date
  },
  trackingId: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add method to check if suborder is delayed
subOrderSchema.methods.isDelayed = function() {
  if (this.shippingStatus === 'pending') {
    return Date.now() > this.deadline;
  }
  return false;
};

module.exports = mongoose.model('SubOrder', subOrderSchema);
