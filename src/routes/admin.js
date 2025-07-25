const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/products');
const SubOrder = require('../models/SubOrder');
const Seller = require('../models/Seller');

// Admin authentication middleware
const isAdminAuthenticated = (req, res, next) => {
  if (req.session.adminId) {
    next();
  } else {
    res.redirect('/admin/login');
  }
};

// Login routes
router.get('/login', (req, res) => {
  res.render('admin/login');
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });

    if (!admin || !(await admin.comparePassword(password))) {
      return res.render('admin/login', { error: 'Invalid credentials' });
    }

    req.session.adminId = admin._id;
    req.session.isAdmin = true;
    res.redirect('/admin/dashboard');
  } catch (error) {
    res.render('admin/login', { error: 'An error occurred' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Dashboard route
router.get('/dashboard', isAdminAuthenticated, async (req, res) => {
  try {
    const [orders, totalOrders, totalProducts, totalUsers] = await Promise.all([
      Order.find().populate('userId').sort({ orderedAt: -1 }).limit(10),
      Order.countDocuments(),
      Product.countDocuments(),
      User.countDocuments()
    ]);

    res.render('admin/dashboard', {
      orders,
      totalOrders,
      totalProducts,
      totalUsers
    });
  } catch (error) {
    res.status(500).send('Error loading dashboard');
  }
});

// Orders route
router.get('/orders', isAdminAuthenticated, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('userId')
      .sort({ orderedAt: -1 });
    res.render('admin/orders', { orders });
  } catch (error) {
    res.status(500).send('Error loading orders');
  }
});

// View Orders route
router.get('/orders/:id', isAdminAuthenticated, async (req, res) => {
  try {
    const orders = await Order.findById(req.params.id)
      .populate('userId');
    // Calculate subtotal for each item
    const itemsWithSubtotal = orders.items.map(item => ({
      ...item.toObject(),
      subtotal: item.price * item.quantity
    }));
    res.render('admin/view-order', { orders: { ...orders.toObject(), items: itemsWithSubtotal } });
  } catch (error) {
    res.status(500).send('Error loading orders');
  }
});

//Order Status Management
router.post("/orders/update-status/:id", isAdminAuthenticated, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    order.status = status;
    await order.save();
    res.json({ success: true, order });
  }catch (error) {
    console.error("Error during order update:", error);
    res.status(500).send("Error updating order status");
  }

  });

// SubOrders route
router.get('/suborders', isAdminAuthenticated, async (req, res) => {
  try {
    const suborders = await SubOrder.find()
      .populate('sellerId')
      .populate('mainOrderId')
      .sort({ createdAt: -1 });
    
    const formattedSuborders = suborders.map(order => ({
      ...order.toObject(),
      isDelayed: order.isDelayed(),
      mainOrderId: order.mainOrderId._id.toString()
    }));

    res.render('admin/suborders', { suborders: formattedSuborders });
  } catch (error) {
    res.status(500).send('Error loading suborders');
  }
});

//Sub-Order Status Management
router.post("/suborders/update-status/:id", isAdminAuthenticated, async (req, res) => {
  try {
    const { status } = req.body;
    const subOrder = await SubOrder.findById(req.params.id);

    subOrder.adminShippingStatus = status;
    await subOrder.save();
    res.json({ success: true, subOrder });
  }catch (error) {
    console.error("Error during order update:", error);
    res.status(500).send("Error updating order status");
  }

  });

// Sellers route
router.get('/sellers', isAdminAuthenticated, async (req, res) => {
  try {
    const sellers = await Seller.find().sort({ createdAt: -1 });
    res.render('admin/sellers', { sellers });
  } catch (error) {
    res.status(500).send('Error loading sellers');
  }
});

// Products route
router.get('/products', isAdminAuthenticated, async (req, res) => {
  try {
    // Populate seller info using sellerID
    const products = await Product.find()
      .populate('sellerID') // This will populate the seller details
      .sort({ createdAt: -1 });
    res.render('admin/products', { products });
  } catch (error) {
    res.status(500).send('Error loading products');
  }
});

router.post('/products/:id/admin-update', async (req, res) => {
  console.log("Admin update request received for product ID:", req.params.id);
    try {
        const { actualPrice, discountType, discount, onSale, isVerified, adminRemark } = req.body;
        const update = {
            actualPrice,
            discountType,
            discount,
            onSale,
            isVerified
        };
        console.log("Update data:", update);

        // Handle admin remarks as a thread (array)
        const product = await Product.findById(req.params.id);
        if (!product) return res.json({ success: false, error: 'Product not found' });

        if (adminRemark && adminRemark.trim()) {
            if (!Array.isArray(product.adminRemarks)) product.adminRemarks = [];
            product.adminRemarks.push({
                text: adminRemark,
                date: new Date()
            });
        }

        //Setup discounted price
        let sellingPrice = actualPrice; // Default to actual price
        if (discountType === 'percentage' && discount > 0) {
            sellingPrice = actualPrice - (actualPrice * discount / 100);
        } else if (discountType === 'fixed' && discount > 0) {
            sellingPrice = actualPrice - discount;
        }
        product.sellingPrice = sellingPrice 

        // Update other fields
        product.discountType = discountType;
        product.discount = discount;
        product.onSale = onSale;
        product.isVerified = isVerified;
        product.actualPrice = actualPrice;

        await product.save();
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});


// Customers route
router.get('/customers', isAdminAuthenticated, async (req, res) => {
  try {
    const customers = await User.find().sort({ createdAt: -1 });
    res.render('admin/customers', { customers });
  } catch (error) {
    res.status(500).send('Error loading customers');
  }
});

// Settings route
router.get('/settings', isAdminAuthenticated, async (req, res) => {
  try {
    const admin = await Admin.findById(req.session.adminId);
    res.render('admin/settings', { admin });
  } catch (error) {
    res.status(500).send('Error loading settings');
  }
});

// Get all suborders with status
router.get('/suborders', isAdminAuthenticated, async (req, res) => {
  try {
    const subOrders = await SubOrder.find()
      .populate('sellerId')
      .populate('mainOrderId')
      .sort({ createdAt: -1 });

    const formattedOrders = subOrders.map(order => ({
      ...order.toObject(),
      isDelayed: order.isDelayed()
    }));

    res.json(formattedOrders);
  } catch (error) {
    res.status(500).send('Error fetching suborders');
  }
});

// Mark suborder as delivered to admin
router.post('/suborders/:id/mark-delivered', isAdminAuthenticated, async (req, res) => {
  try {
    const subOrder = await SubOrder.findById(req.params.id);

    if (!subOrder) {
      return res.status(404).send('SubOrder not found');
    }

    subOrder.shippingStatus = 'delivered-to-admin';
    subOrder.deliveredToAdminAt = new Date();
    await subOrder.save();

    res.json({ success: true, subOrder });
  } catch (error) {
    res.status(500).send('Error updating suborder status');
  }
});

// Update shipping status for customer
router.post('/orders/:orderId/shipping-status', isAdminAuthenticated, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.orderId);
    const subOrders = await SubOrder.find({ mainOrderId: req.params.orderId });

    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Update main order and all suborders
    order.status = status;
    await order.save();

    await Promise.all(subOrders.map(async (subOrder) => {
      subOrder.shippingStatus = status;
      await subOrder.save();
    }));

    res.json({ success: true, order, subOrders });
  } catch (error) {
    res.status(500).send('Error updating shipping status');
  }
});

module.exports = router;