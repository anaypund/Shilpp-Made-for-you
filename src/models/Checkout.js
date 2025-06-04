
const mongoose = require('mongoose');

const checkoutSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
  pinCode: {
    type: Number,
    required: true,
  },
  payMethod:{
    type: String,
    required: true
  },
  email:{
    type: String,
    required: true
  },
  phoneNumber:{
    type: Number,
    required: true
  }
});

module.exports = mongoose.model('Checkout', checkoutSchema);
