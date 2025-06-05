const express = require("express");
const router = express.Router();
const Seller = require("../models/Seller");
const Product = require("../models/products");
const Order = require("../models/Order");
const SubOrder = require("../models/SubOrder");
const multer = require("multer");
const path = require("path");

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: "./public/images/",
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname),
    );
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 30000000 }, // 30MB per file
  fileFilter: function (req, file, cb) {
    // Accept images and videos
    const filetypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb("Error: Images and Videos Only!");
    }
  },
}).fields([
  { name: "productImages", maxCount: 10 },
  { name: "productVideos", maxCount: 2 }
]);

// Serve static files from public directory
router.use("/static", express.static("public"));

function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb("Error: Images Only!");
  }
}

// Authentication middleware
const isSellerAuthenticated = (req, res, next) => {
  if (req.session.sellerId) {
    next();
  } else {
    res.redirect("/seller/login");
  }
};

// Login routes
router.get("/login", (req, res) => {
  res.render("seller/login");
});

// Registration route
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, shopName } = req.body;

    // Check if seller already exists
    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) {
      return res.render("seller/login", { error: "Email already registered" });
    }

    // Create new seller
    const seller = new Seller({
      name,
      email,
      password,
      shopName,
    });

    await seller.save();
    req.session.sellerId = seller._id;
    res.redirect("/seller/dashboard");
  } catch (error) {
    res.render("seller/login", { error: "Error creating account" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const seller = await Seller.findOne({ email });

    if (!seller || !(await seller.comparePassword(password))) {
      return res.render("seller/login", { error: "Invalid email or password" });
    }

    req.session.sellerId = seller._id;
    res.redirect("/seller/dashboard");
  } catch (error) {
    res.render("seller/login", { error: "An error occurred" });
  }
});

// Dashboard routes
router.get("/dashboard", isSellerAuthenticated, async (req, res) => {
  try {
    const seller = await Seller.findById(req.session.sellerId);
    const products = await Product.find({ sellerID: req.session.sellerId });
    const SubOrder = require('../models/SubOrder');
    const orders = await SubOrder.find({ sellerId: req.session.sellerId })
      .populate("items.productId")
      .populate("mainOrderId")
      .populate({
        path: "mainOrderId",
        populate: { path: "userId" }
      });

    res.render("seller/dashboard", { seller, products, orders });
  } catch (error) {
    res.status(500).send("Error loading dashboard");
  }
});

// Product management routes
router.post(
  "/products/add",
  isSellerAuthenticated,
  upload,
  async (req, res) => {
    try {
      const {
        productName, price, description, keyPoints, inventory,
        width, length, height, weight, isHandmade, material,
        otherSpecs, careInstructions
      } = req.body;
      const seller = await Seller.findById(req.session.sellerId);

      // Handle images and videos
      const images = (req.files['productImages'] || []).map(f => "/static/images/" + f.filename);
      const videos = (req.files['productVideos'] || []).map(f => "/static/images/" + f.filename);

      const product = new Product({
        productName,
        price: Number(price),
        imagePath: images[0] || '', // For backward compatibility
        productImages: images,
        productVideos: videos,
        sellerName: seller.shopName,
        sellerID: seller._id,
        description,
        keyPoints: keyPoints.split(",").map((point) => point.trim()),
        keyWords: productName.toLowerCase().split(" "),
        inventory: Number(inventory) || 0,
        width: Number(width),
        length: Number(length),
        height: height ? Number(height) : undefined,
        weight: weight ? Number(weight) : undefined,
        isHandmade: isHandmade === "on" || isHandmade === "true" || isHandmade === true,
        material,
        otherSpecs,
        careInstructions
      });

      await product.save();
      res.redirect("/seller/dashboard");
    } catch (error) {
      console.error(error);
      res.status(500).send("Error adding product");
    }
  }
);

router.post(
  "/products/update/:id",
  isSellerAuthenticated,
  upload,
  async (req, res) => {
    try {
      const {
        productName, inventory, price, description, keyPoints,
        width, length, height, weight, isHandmade, material,
        otherSpecs, careInstructions
      } = req.body;

      const updateData = {
        productName,
        price: Number(price),
        description,
        inventory: Number(inventory) || 0,
        keyPoints: keyPoints.split(",").map((point) => point.trim()),
        width: Number(width),
        length: Number(length),
        height: height ? Number(height) : undefined,
        weight: weight ? Number(weight) : undefined,
        isHandmade: isHandmade === "on" || isHandmade === "true" || isHandmade === true,
        material,
        otherSpecs,
        careInstructions
      };

      // Handle new uploads
      if (req.files && req.files['productImages'] && req.files['productImages'].length > 0) {
        updateData.productImages = req.files['productImages'].map(f => "/static/images/" + f.filename);
        updateData.imagePath = updateData.productImages[0];
      }
      if (req.files && req.files['productVideos'] && req.files['productVideos'].length > 0) {
        updateData.productVideos = req.files['productVideos'].map(f => "/static/images/" + f.filename);
      }

      await Product.findByIdAndUpdate(req.params.id, updateData);
      res.redirect("/seller/dashboard");
    } catch (error) {
      console.error(error);
      res.status(500).send("Error updating product");
    }
  }
);

// Delete product route
router.delete(
  "/products/delete/:id",
  isSellerAuthenticated,
  async (req, res) => {
    try {
      await Product.findByIdAndDelete(req.params.id);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).send("Error deleting product");
    }
  },
);

//Order Status Management
router.post("/orders/update-status/:id", isSellerAuthenticated, async (req, res) => {
  try {
    console.log("Updating order status for suborder ID:", req.params.id);
    console.log("New status:", req.body.status);
    console.log("Seller ID from session:", req.session.sellerId);
    const { status } = req.body;
    const subOrder = await SubOrder.findById(req.params.id);
    console.log(subOrder.sellerId)
    
    if (!subOrder || subOrder.sellerId.toString() !== req.session.sellerId.toString()) {
      console.log("Unauthorized access attempt");
      return res.status(403).send("Unauthorized");
    }

    subOrder.shippingStatus = status;
    console.log("SubOrder before saving:", subOrder);
    await subOrder.save();
    console.log("Order status updated successfully:", subOrder);
    res.json({ success: true, subOrder });
  }catch (error) {
    console.error("Error during order update:", error);
    res.status(500).send("Error updating order status");
  }

  });

// Ship to admin route
router.post(
  "/suborders/:id/ship-to-admin",
  isSellerAuthenticated,
  async (req, res) => {
    try {
      const { trackingId } = req.body;
      const subOrder = await SubOrder.findById(req.params.id);
      
      if (!subOrder || subOrder.sellerId.toString() !== req.session.sellerId) {
        return res.status(403).send("Unauthorized");
      }

      subOrder.shippingStatus = 'shipped-to-admin';
      subOrder.shippedAt = new Date();
      if (trackingId) {
        subOrder.trackingId = trackingId;
      }
      
      await subOrder.save();
      res.json({ success: true, subOrder });
    } catch (error) {
      res.status(500).send("Error updating shipping status");
    }
  }
);



module.exports = router;
