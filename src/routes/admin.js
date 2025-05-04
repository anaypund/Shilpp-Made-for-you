
const express = require('express');
const router = express.Router();
const SubOrder = require('../models/SubOrder');
const Order = require('../models/Order');

// Authentication middleware for admin
const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    next();
  } else {
    res.status(403).send('Admin access required');
  }
};

// Get all suborders with status
router.get('/suborders', isAdmin, async (req, res) => {
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
router.post('/suborders/:id/mark-delivered', isAdmin, async (req, res) => {
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
router.post('/orders/:orderId/shipping-status', isAdmin, async (req, res) => {
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
