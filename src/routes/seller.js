const express = require("express");
const routes = express.Router();
const Seller = require("../models/Seller");
const Product = require("../models/products");
const Order = require("../models/Order");
const SubOrder = require("../models/SubOrder");
const multer = require("multer");
const stream = require("stream");
const admin = require("./firebase");

// GCS Upload configuration
const { Storage } = require('@google-cloud/storage');
const path = require('path');

// Auth using service account JSON key
const gcstorage = new Storage();

const bucketName = 'shilp-media';

async function uploadFile(localFilePath, destinationName) {
  await gcstorage.bucket(bucketName).upload(localFilePath, {
    destination: destinationName,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });
  console.log(`Uploaded ${localFilePath} as ${destinationName}`);
}

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
  storage: multer.memoryStorage(),
  limits: { fileSize: 30000000 }, // 30MB per file
  fileFilter: function (req, file, cb) {
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
routes.use("/static", express.static("public"));

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
routes.get("/login", (req, res) => {
  res.render("seller/login");
});

// Update multer fields for seller registration file uploads
const sellerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30000000 },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb("Error: Images and PDFs Only!");
    }
  },
}).fields([
  { name: "personalIdProof", maxCount: 1 },
  { name: "brandLogo", maxCount: 1 },
  { name: "businessIdProof", maxCount: 1 }
]);

// Registration route
routes.post("/register", sellerUpload, async (req, res) => {
  try {
    const {
      name, email, password, shopName, phoneNumber, altNumber,
      country, state, city, address, pincode,
      processTime, returnPolicy,
      paymentType, upiId, bankName, accountNumber, ifsc, passbookName, branchLocation,
      socialMedia, story, experience,
      isBusinessRegistered
    } = req.body;

    // Check if seller already exists
    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) {
      return res.render("seller/login", { error: "Email already registered" });
    }

    // Upload files to GCS under "Seller DB"
    async function uploadSellerFile(field) {
      if (req.files && req.files[field] && req.files[field][0]) {
        const file = req.files[field][0];
        const ext = path.extname(file.originalname);
        const gcsName = `Seller DB/${field}-${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
        return await uploadBufferToGCS(file.buffer, gcsName, file.mimetype);
      }
      return undefined;
    }

    const personalIdProof = await uploadSellerFile("personalIdProof");
    const brandLogo = await uploadSellerFile("brandLogo");
    let businessIdProof;
    if (isBusinessRegistered === "yes") {
      businessIdProof = await uploadSellerFile("businessIdProof");
    }

    // Create new seller
    const seller = new Seller({
      name,
      email,
      password,
      shopName,
      altNumber,
      country,
      state,
      city,
      address,
      pincode,
      processTime,
      returnPolicy,
      paymentType,
      upiId: paymentType === "upi" ? upiId : undefined,
      bankName: paymentType === "bank" ? bankName : undefined,
      accountNumber: paymentType === "bank" ? accountNumber : undefined,
      ifsc: paymentType === "bank" ? ifsc : undefined,
      passbookName: paymentType === "bank" ? passbookName : undefined,
      branchLocation: paymentType === "bank" ? branchLocation : undefined,
      personalIdProof,
      phoneNumber,
      socialMedia,
      brandLogo,
      story,
      experience,
      isBusinessRegistered,
      businessIdProof: isBusinessRegistered === "yes" ? businessIdProof : undefined
    });

    await seller.save();
    req.session.sellerId = seller._id;
    res.redirect("/seller/dashboard");
  } catch (error) {
    console.error(error);
    res.render("seller/login", { error: "Error creating account" });
  }
});

routes.post("/login", async (req, res) => {
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

routes.get("/reset-password", (req, res) => {
    res.render("seller/reset-password-seller");
});

// POST /reset-password/check
routes.post('/reset-password/check', async (req, res) => {
    let { email, phone, countryCode } = req.body;
    console.log("Reset Password Check:", email, phone);
    const localNumber = phone.startsWith(countryCode)
      ? phone.slice(countryCode.length)
      : phone;

    console.log(localNumber); 
    try {
        const user = await Seller.findOne({ email, phoneNumber: localNumber });
        // console.log(user);
        if (!user) {
            return res.json({ success: false, error: "No user found with these details." });
        }
        // Optionally, mask phone for frontend
        res.json({ success: true, phone: user.phoneNumber });
    } catch (err) {
        res.json({ success: false, error: "Server error." });
    }
});


// POST /reset-password/verify-token
routes.post('/reset-password/verify-token', async (req, res) => {
    const { idToken } = req.body;
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const phone = decodedToken.phone_number;

        if (!phone) {
            return res.json({ success: false, error: "Invalid token: no phone number found." });
        }

        // You can attach this phone to session or return success to frontend
        // Example: set in session for the password reset page
        req.session.resetPhoneSeller = phone;
        res.json({ success: true });
    } catch (error) {
        console.error('Error verifying ID token:', error);
        res.status(401).json({ success: false, error: "Invalid or expired token." });
    }
});


routes.post('/reset-password', async (req, res) => {
    const { email, newPassword, countryCode } = req.body;
    const phone = req.session.resetPhoneSeller;

    if (!phone) {
        return res.render('seller/reset-password-seller', { error: "Unauthorized attempt. Please verify OTP again." });
    }

     try {
        const localNumber = phone.startsWith(countryCode)
          ? phone.slice(countryCode.length)
          : phone;

        const user = await Seller.findOne({ email, phoneNumber: localNumber });
        if (!user) {
            return res.render('seller/reset-password-seller', { error: "Seller not found." });
        }

        user.password = newPassword; // ⚠️ ideally hash this!
        await user.save();
        req.session.resetPhoneSeller = null;


        res.redirect('/seller/login?reset=success');
    } catch (err) {
        console.error(err);
        res.render('seller/reset-password-seller', { error: "Server error." });
    }
});

// Dashboard routes
routes.get("/dashboard", isSellerAuthenticated, async (req, res) => {
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
routes.post(
  "/products/add",
  isSellerAuthenticated,
  upload,
  async (req, res) => {
    try {
      const {
        productName, price, description, tags, inventory, category, subCategory, subSubCategory,
        width, length, height, weight, isHandmade, material,
        otherSpecs, careInstructions
      } = req.body;
      const seller = await Seller.findById(req.session.sellerId);

      // Upload images to GCS
      const images = req.files['productImages']
        ? await Promise.all(req.files['productImages'].map(async (file) => {
            const ext = path.extname(file.originalname);
            const gcsName = `images/${file.fieldname}-${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
            return await uploadBufferToGCS(file.buffer, gcsName, file.mimetype);
          }))
        : [];

      // Upload videos to GCS
      const videos = req.files['productVideos']
        ? await Promise.all(req.files['productVideos'].map(async (file) => {
            const ext = path.extname(file.originalname);
            const gcsName = `videos/${file.fieldname}-${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
            return await uploadBufferToGCS(file.buffer, gcsName, file.mimetype);
          }))
        : [];

      const product = new Product({
        productName,
        price: Number(price),
        imagePath: images[0] || '',
        category,
        subCategory,
        subSubCategory,
        productImages: images,
        productVideos: videos,
        sellerID: seller._id,
        description,
        tags: tags.split(",").map((point) => point.trim()),
        keyWords: productName.toLowerCase().split(" "),
        inventory: Number(inventory) || 0,
        width: Number(width),
        length: Number(length),
        height: height ? Number(height) : undefined,
        weight: weight ? Number(weight) : undefined,
        isHandmade: isHandmade === "on" || isHandmade === "true" || isHandmade === true,
        material,
        otherSpecs,
        careInstructions,
        // Customization fields
        isCustomizable: req.body.isCustomizable === "true" || req.body.isCustomizable === "on" || req.body.isCustomizable === true,
        customizationLabel: req.body.customizationLabel || undefined,
        customizationType: req.body.customizationType || "none"
      });

      await product.save();
      res.redirect("/seller/dashboard");
    } catch (error) {
      console.error(error);
      res.status(500).send("Error adding product");
    }
  }
);

routes.post(
  "/products/update/:id",
  isSellerAuthenticated,
  upload,
  async (req, res) => {
    try {
      const {
        productName, inventory, price, description, tags, category, subCategory, subSubCategory,
        width, length, height, weight, isHandmade, material,
        otherSpecs, careInstructions
      } = req.body;

      const updateData = {
        productName,
        price: Number(price),
        description,
        category,
        subCategory,
        subSubCategory,
        keyWords: productName.toLowerCase().split(" "),
        inventory: Number(inventory) || 0,
        tags: tags.split(",").map((point) => point.trim()),
        width: Number(width),
        length: Number(length),
        height: height ? Number(height) : undefined,
        weight: weight ? Number(weight) : undefined,
        isHandmade: isHandmade === "on" || isHandmade === "true" || isHandmade === true,
        material,
        otherSpecs,
        careInstructions,
        // Customization fields
        isCustomizable: req.body.isCustomizable === "true" || req.body.isCustomizable === "on" || req.body.isCustomizable === true,
        customizationLabel: req.body.customizationLabel || undefined,
        customizationType: req.body.customizationType || "none"
      };

      // Handle new uploads
      if (req.files && req.files['productImages'] && req.files['productImages'].length > 0) {
        updateData.productImages = await Promise.all(
          req.files['productImages'].map(async (file) => {
            const ext = path.extname(file.originalname);
            const gcsName = `images/${file.fieldname}-${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
            return await uploadBufferToGCS(file.buffer, gcsName, file.mimetype);
          })
        );
        updateData.imagePath = updateData.productImages[0];
      }
      if (req.files && req.files['productVideos'] && req.files['productVideos'].length > 0) {
        updateData.productVideos = await Promise.all(
          req.files['productVideos'].map(async (file) => {
            const ext = path.extname(file.originalname);
            const gcsName = `videos/${file.fieldname}-${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
            return await uploadBufferToGCS(file.buffer, gcsName, file.mimetype);
          })
        );
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
routes.delete(
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
routes.post("/orders/update-status/:id", isSellerAuthenticated, async (req, res) => {
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
routes.post(
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

// Define the uploadBufferToGCS function
async function uploadBufferToGCS(buffer, destination, mimetype) {
  return new Promise((resolve, reject) => {
    const bucket = gcstorage.bucket(bucketName);
    const file = bucket.file(destination);
    const passthroughStream = new stream.PassThrough();
    passthroughStream.end(buffer);

    passthroughStream
      .pipe(file.createWriteStream({
        metadata: {
          contentType: mimetype,
          cacheControl: 'public, max-age=31536000',
        },
        resumable: false,
      }))
      .on('error', reject)
      .on('finish', () => {
        resolve(`https://storage.googleapis.com/${bucketName}/${destination}`);
      });
  });
}

module.exports = routes;
