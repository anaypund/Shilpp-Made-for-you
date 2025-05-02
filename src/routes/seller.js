
const express = require('express');
const router = express.Router();
const Seller = require('../models/Seller');
const Product = require('../models/products');
const Order = require('../models/Order');
const multer = require('multer');
const path = require('path');

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: './public/images/',
  filename: function(req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10000000 }, // 10MB limit
  fileFilter: function(req, file, cb) {
    checkFileType(file, cb);
  }
}).single('productImage');

function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images Only!');
  }
}

// Authentication middleware
const isSellerAuthenticated = (req, res, next) => {
  if (req.session.sellerId) {
    next();
  } else {
    res.redirect('/seller/login');
  }
};

// Login routes
router.get('/login', (req, res) => {
  res.render('seller/login');
});

// Registration route
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, shopName } = req.body;
    
    // Check if seller already exists
    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) {
      return res.render('seller/login', { error: 'Email already registered' });
    }
    
    // Create new seller
    const seller = new Seller({
      name,
      email,
      password,
      shopName
    });
    
    await seller.save();
    req.session.sellerId = seller._id;
    res.redirect('/seller/dashboard');
  } catch (error) {
    res.render('seller/login', { error: 'Error creating account' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const seller = await Seller.findOne({ email });
    
    if (!seller || !(await seller.comparePassword(password))) {
      return res.render('seller/login', { error: 'Invalid email or password' });
    }
    
    req.session.sellerId = seller._id;
    res.redirect('/seller/dashboard');
  } catch (error) {
    res.render('seller/login', { error: 'An error occurred' });
  }
});

// Dashboard routes
router.get('/dashboard', isSellerAuthenticated, async (req, res) => {
  try {
    const seller = await Seller.findById(req.session.sellerId);
    const products = await Product.find({ sellerID: req.session.sellerId });
    const orders = await Order.find({ 'items.productId': { $in: products.map(p => p._id) } })
                             .populate('items.productId')
                             .populate('userId');
    
    res.render('seller/dashboard', { seller, products, orders });
  } catch (error) {
    res.status(500).send('Error loading dashboard');
  }
});

// Product management routes
router.post('/products/add', isSellerAuthenticated, upload, async (req, res) => {
  try {
    const { productName, price, description, keyPoints } = req.body;
    const seller = await Seller.findById(req.session.sellerId);
    
    const product = new Product({
      productName,
      price: Number(price),
      imagePath: '/images/' + req.file.filename,
      sellerName: seller.shopName,
      sellerID: seller._id,
      description,
      keyPoints: keyPoints.split(',').map(point => point.trim()),
      keyWords: productName.toLowerCase().split(' ')
    });
    
    await product.save();
    res.redirect('/seller/dashboard');
  } catch (error) {
    res.status(500).send('Error adding product');
  }
});

router.post('/products/update/:id', isSellerAuthenticated, upload, async (req, res) => {
  try {
    const { productName, price, description, keyPoints } = req.body;
    const updateData = {
      productName,
      price: Number(price),
      description,
      keyPoints: keyPoints.split(',').map(point => point.trim())
    };
    
    if (req.file) {
      updateData.imagePath = '/images/' + req.file.filename;
    }
    
    await Product.findByIdAndUpdate(req.params.id, updateData);
    res.redirect('/seller/dashboard');
  } catch (error) {
    res.status(500).send('Error updating product');
  }
});

// Delete product route
router.delete('/products/delete/:id', isSellerAuthenticated, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send('Error deleting product');
  }
});

// Update order status route
router.post('/orders/update-status/:id', isSellerAuthenticated, async (req, res) => {
  try {
    const { status } = req.body;
    await Order.findByIdAndUpdate(req.params.id, { status });
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send('Error updating order status');
  }
});

module.exports = router;
