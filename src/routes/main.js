const express = require("express");
const mongoose = require("mongoose");
const routes = express.Router();
const { urlencoded } = require("body-parser");
const bodyParser = require("body-parser");
const { Console, log } = require("console");
const session = require("express-session");
require("dotenv").config();
const crypto = require("crypto"); // Added for HMAC
const admin = require("./firebase");
const nodemailer = require('nodemailer');

const { applyDiscount } = require('../utils/priceUtils');


routes.use(express.json());

const User = require("../models/User");
const Order = require("../models/Order"); // Added Order model
const Product = require("../models/products");
const Seller = require("../models/Seller");
const SubOrder = require('../models/SubOrder');

const { Storage } = require('@google-cloud/storage');
const path = require('path');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SHILP_EMAIL_USER, // your email
        pass: process.env.SHILP_EMAIL_PASS  // your app password 
    }
});

// Auth using service account JSON key
const storage = new Storage();

const bucketName = 'shilp-media';

async function uploadFile(localFilePath, destinationName) {
  await storage.bucket(bucketName).upload(localFilePath, {
    destination: destinationName,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });
  console.log(`Uploaded ${localFilePath} as ${destinationName}`);
}


routes.use(
    session({
        secret: process.env.SESSION_SECRET || "your-secret-key",
        resave: false,
        saveUninitialized: false,
    }),
);

// Authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        req.session.returnTo = req.originalUrl;
        res.redirect("/login");
    }
};

routes.get("/login", (req, res) => {
    res.render("login");
});

routes.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user || !(await user.comparePassword(password))) {
            return res.render("login", { error: "Invalid email or password" });
        }
        
        req.session.userId = user._id;
        
        const redirectTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        res.redirect(redirectTo);
    } catch (error) {
        res.render("login", { error: "An error occurred" });
    }
});

routes.get("/signup", (req, res) => {
    res.render("signup");
});

routes.post("/signup", async (req, res) => {
    const { name, email, number, password, countryCode, idToken } = req.body;

    try {
    // 1. Verify Firebase ID Token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const phone = decodedToken.phone_number;
    const numberWithCountryCode = `${countryCode}${number}`;
    
    if (!phone || phone !== numberWithCountryCode) {
      return res.render("signup", { error: "Phone verification failed. Please try again." });
    }

    // 2. Check if user already exists
    const existingUserMail = await User.findOne({ email });
    const existingUserPhone = await User.findOne({ numberWithCountryCode });
    if (existingUserMail || existingUserPhone) {
      return res.render("signup", { error: "Account already exists" });
    }

    // 3. Save user to database
    const user = new User({ name, email, number: numberWithCountryCode, password });
    await user.save();

    // 4. Create session
    req.session.userId = user._id;
    
    res.redirect("/");
  } catch (error) {
    console.error("Signup error:", error);
    res.render("signup", { error: "An error occurred during signup." });
  }
});

routes.get("/reset-password", (req, res) => {
    res.render("reset-password.hbs");
});

// POST /reset-password/check
routes.post('/reset-password/check', async (req, res) => {
    let { email, phone } = req.body;
    if (phone && phone.startsWith('+')) {
        phone = phone.substring(1);
    }
    try {
        const user = await User.findOne({ email, number: phone });
        // console.log(user);
        if (!user) {
            return res.json({ success: false, error: "No user found with these details." });
        }
        // Optionally, mask phone for frontend
        res.json({ success: true, phone: user.number });
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
        req.session.resetPhone = phone;
        res.json({ success: true });
    } catch (error) {
        console.error('Error verifying ID token:', error);
        res.status(401).json({ success: false, error: "Invalid or expired token." });
    }
});


routes.post('/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
    const phone = req.session.resetPhone;

    if (!phone) {
        return res.render('reset-password', { error: "Unauthorized attempt. Please verify OTP again." });
    }

     try {
        const user = await User.findOne({ email, number: phone });
        if (!user) {
            return res.render('reset-password', { error: "User not found." });
        }

        user.password = newPassword; // ⚠️ ideally hash this!
        await user.save();

        res.redirect('/login?reset=success');
    } catch (err) {
        console.error(err);
        res.render('reset-password', { error: "Server error." });
    }
});


routes.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

routes.get("/profile", isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const orders = await Order.find({ userId: req.session.userId })
            .sort({ createdAt: -1 })
            .populate("items.productId");

        res.render("profile", {
            user: user,
            orders: orders,
        });
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).send("Error loading profile");
    }
});
const Razorpay = require("razorpay");
const { RAZORPAY_ID_KEY, RAZORPAY_SECRET_KEY } = process.env;

const razorpay = new Razorpay({
    key_id: RAZORPAY_ID_KEY,
    key_secret: RAZORPAY_SECRET_KEY,
});

//Models
const Products = require("../models/products");
const CartItem = require("../models/CartItem");
const Checkout = require("../models/Checkout");

routes.use(bodyParser.urlencoded({ extended: true }));
routes.use(bodyParser.json());
routes.use("/static", express.static("public"));

const shuffleArray = (array) => {
    return array.sort(() => Math.random() - 0.5);
};

routes.get("/", async (req, res) => {
    try {
        const products = await Products.find({ isVerified: true });
        const user = req.session.userId ? await User.findById(req.session.userId) : null;

        // Shuffle products
        const shuffledProducts = shuffleArray(products);

        const processedProducts = shuffledProducts.map(product => {
            let actualPrice = product.sellingPrice;
            let price = null;
            let discountBadge = null;

            if (product.discount && product.discount !== 0) {
                if (product.discountType === "percentage") {
                    price = actualPrice;
                    actualPrice = actualPrice - (actualPrice * product.discount / 100);
                    discountBadge = `-${product.discount}% off`;
                } else if (product.discountType === "fixed") {
                    price = actualPrice;
                    actualPrice = actualPrice - product.discount;
                    discountBadge = `-₹${product.discount} off`;
                }
            }

            return {
                ...product.toObject(),
                actualPrice: actualPrice.toFixed(0),
                price: price ? price.toFixed(2) : null,
                discountBadge
            };
        });

        res.status(200).render("index", {
            Product: processedProducts,
            user,
        });
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).send("Internal Server Error");
    }
});


routes.get('/filtered-products', async (req, res) => {
    try {
        const search = req.query.search ? req.query.search.trim() : '';
        const page = parseInt(req.query.page) || 1;
        const limit = 15;
        const skip = (page - 1) * limit;

        // Build search conditions
        let sellerIds = [];
        if (search) {
            // Find sellers whose name matches search
            const sellers = await Seller.find({ name: { $regex: search, $options: 'i' } }, '_id');
            sellerIds = sellers.map(s => s._id);
        }

        // Always require isVerified: true
        const baseCondition = { isVerified: true };

        const query = search
            ? {
                ...baseCondition,
                $or: [
                    { sellerID: { $in: sellerIds } },
                    { keyWords: { $regex: search, $options: 'i' } },
                    { tags: { $regex: search, $options: 'i' } },
                    { category: { $regex: search, $options: 'i' } },
                    { subCategory: { $regex: search, $options: 'i' } },
                    { subSubCategory: { $regex: search, $options: 'i' } }
                ]
            }
            : baseCondition;

        // Get total count for pagination
        const total = await Product.countDocuments(query);

        // Get products for this page
        let products = await Product.find(query)
            .populate('sellerID')
            .skip(skip)
            .limit(limit);

        // Shuffle the products
        products = products.sort(() => Math.random() - 0.5);

        // Apply discount logic just like other routes
        const productsForView = products.map(p => applyDiscount(p.toObject()));

        res.render('filtered-products', {
            products: productsForView,
            search,
            page,
            hasMore: total > page * limit
        });
    } catch (err) {
        res.status(500).send('Error loading products');
    }
});

routes.get('/seller-products/:sellerId', async (req, res) => {
    try {
        const sellerId = req.params.sellerId;
        const page = parseInt(req.query.page) || 1;
        const limit = 15;
        const skip = (page - 1) * limit;

        const seller = await Seller.findById(sellerId);
        if (!seller) return res.status(404).send('Seller not found');

        const baseCondition = { isVerified: true, sellerID: sellerId };

        const total = await Product.countDocuments(baseCondition);

        const products = await Product.find(baseCondition)
            .populate('sellerID')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const productsForView = products.map(p => ({
            ...p.toObject(),
            discountBadge: p.discount && p.discount > 0
                ? (p.discountType === 'percentage'
                    ? `-${p.discount}%`
                    : `-₹${p.discount}`)
                : null,
        }));

        res.render('seller-products', {
            products: productsForView,
            seller,
            page,
            hasMore: total > page * limit
        });
    } catch (err) {
        res.status(500).send('Error loading seller products');
    }
});


routes.get("/product-details", async (req, res) => {
    const productId = req.query.id;

    try {
        // Fetch main product and populate seller
        const productArray = await Products.find({ _id: productId }).populate('sellerID');
        if (!productArray || productArray.length === 0) {
            return res.status(404).send("Product not found");
        }

        const product = productArray[0];
        const keyPoints = product.tags;

        // --- DISCOUNT LOGIC for main product ---
        let actualPrice = product.sellingPrice;
        let price = null;
        let discountBadge = null;

        if (product.discount && product.discount !== 0) {
            if (product.discountType === "percentage") {
                price = actualPrice;
                actualPrice = actualPrice - (actualPrice * product.discount / 100);
                discountBadge = `-${product.discount}% off`;
            } else if (product.discountType === "fixed") {
                price = actualPrice;
                actualPrice = actualPrice - product.discount;
                discountBadge = `-₹${product.discount} off`;
            }
        }

        const processedProduct = {
            ...product.toObject(),
            actualPrice: actualPrice.toFixed(0),
            price: price ? price.toFixed(2) : null,
            discountBadge
        };

        // --- Fetch Other Products by Seller ---
        const sellerProductsRaw = await Products.aggregate([
            {
                $match: {
                    sellerID: product.sellerID._id,
                    _id: { $ne: product._id },
                    isVerified: true
                }
            },
            { $sample: { size: 10 } }
        ]);

        // --- Apply Discount Logic to sellerProducts ---
        const sellerProducts = sellerProductsRaw.map(prod => {
            let actualPrice = prod.sellingPrice;
            let price = null;
            let discountBadge = null;

            if (prod.discount && prod.discount !== 0) {
                if (prod.discountType === "percentage") {
                    price = actualPrice;
                    actualPrice = actualPrice - (actualPrice * prod.discount / 100);
                    discountBadge = `-${prod.discount}% off`;
                } else if (prod.discountType === "fixed") {
                    price = actualPrice;
                    actualPrice = actualPrice - prod.discount;
                    discountBadge = `-₹${prod.discount} off`;
                }
            }

            return {
                ...prod,
                actualPrice: actualPrice.toFixed(0),
                price: price ? price.toFixed(2) : null,
                discountBadge
            };
        });

        // --- Fetch Similar Products ---
        const similarProductsRaw = await Products.aggregate([
            {
                $match: {
                    _id: { $ne: product._id },
                    isVerified: true,
                    $or: [
                        { category: product.category },
                        { subCategory: product.subCategory },
                        { subSubCategory: product.subSubCategory },
                        { tags: { $in: product.tags || [] } }
                    ]
                }
            },
            { $sample: { size: 10 } }
        ]);

        // --- Apply Discount Logic to similarProducts ---
        const similarProducts = similarProductsRaw.map(prod => {
            let actualPrice = prod.sellingPrice;
            let price = null;
            let discountBadge = null;

            if (prod.discount && prod.discount !== 0) {
                if (prod.discountType === "percentage") {
                    price = actualPrice;
                    actualPrice = actualPrice - (actualPrice * prod.discount / 100);
                    discountBadge = `-${prod.discount}% off`;
                } else if (prod.discountType === "fixed") {
                    price = actualPrice;
                    actualPrice = actualPrice - prod.discount;
                    discountBadge = `-₹${prod.discount} off`;
                }
            }

            return {
                ...prod,
                actualPrice: actualPrice.toFixed(2),
                price: price ? price.toFixed(2) : null,
                discountBadge
            };
        });


        const user = req.session.userId
            ? await User.findById(req.session.userId)
            : null;

        res.render("product-details", {
            product: processedProduct,
            keyPoints: keyPoints,
            user: user,
            seller: product.sellerID,
            sellerProducts: sellerProducts,
            similarProducts: similarProducts // ✅ passed to view
        });


    } catch (error) {
        console.error(error);
        res.status(500).send("Product not found");
    }
});


routes.post("/cart", isAuthenticated, async (req, res) => {
    const productId = req.body.id;
    const userId = req.session.userId;
    try {
        const product = await Products.findById(productId);
        if (!product || product.inventory <= 0) {
            return res.status(400).send("Product is out of stock");
        }

        let cartItem = await CartItem.findOne({
            userId: userId,
            productId: productId,
        });

        if (cartItem) {
            // Check if increasing quantity exceeds inventory
            if (cartItem.quantity + 1 > product.inventory) {
                return res.status(400).send("Not enough inventory available");
            }
            cartItem.quantity += 1;
            await cartItem.save();
        } else {
            cartItem = new CartItem({
                userId: userId,
                productId: productId,
                quantity: 1,
            });
            await cartItem.save();
        }
        console.log("Added to cart");
        res.redirect("/cart");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error adding to cart");
    }
});

routes.get("/cart", isAuthenticated, async (req, res) => {
    const userId = req.session.userId;

    try {
        const cartItems = await CartItem.find({ userId: userId }).populate(
            "productId",
        );
        let total = 0;
        cartItems.forEach((item) => {
            total += item.productId.sellingPrice * item.quantity;
        });
        console.log(total);
        res.render("cart", {
            cartItems: cartItems,
            total: total,
            user: req.session.userId
                ? await User.findById(req.session.userId)
                : null,
        });
    } catch (error) {
        console.error("Error fetching cart items:", error);
        res.status(500).send("Server Error");
    }
});

routes.post("/cart/update", isAuthenticated, async (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.session.userId;
    try {
        if (quantity <= 0) {
            await CartItem.deleteOne({ userId: userId, productId: productId });
        } else {
            await CartItem.findOneAndUpdate(
                { userId: userId, productId: productId },
                { quantity },
            );
        }
        res.redirect("/cart");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error updating cart");
    }
});

routes.get("/checkout/payment", async (req, res) => {
    const userId = req.session.userId; // Use session userId instead of query parameter
    try {
        const cartItems = await CartItem.find({ userId: userId }).populate(
            "productId",
        );
        let shippingCharges = 100;
        let subTotal = 0;
        cartItems.forEach((item) => {
            if(item.productId.discountType === "percentage") {
                sellPrice = item.productId.sellingPrice - (item.productId.sellingPrice * item.productId.discount / 100);
            } else if(item.productId.discountType === "fixed") {
                sellPrice = item.productId.sellingPrice - item.productId.discount;
            }
            subTotal += sellPrice * item.quantity;
        });
        const costumer = await Checkout.findOne({ userId: userId });
        if (
            costumer &&
            costumer.state.trim().toLowerCase() === "mh" &&
            costumer.city.trim().toLowerCase() === "amravati"
        ) {
            shippingCharges = 0;
        }
        total = subTotal + shippingCharges;
        res.render("payment", {
            cartItems: cartItems,
            userId: userId,
            subTotal: subTotal,
            shippingCharges: shippingCharges,
            total: total,
            name: costumer.name,
            email: costumer.email,
            contact: costumer.phoneNumber,
            user: req.session.userId
                ? await User.findById(req.session.userId)
                : null,
        });
    } catch (error) {
        console.error("Error fetching cart items:", error);
        res.status(500).send("Server Error");
    }
});

routes.get("/checkout/shipping-info", isAuthenticated, async (req, res) => {
    const userId = req.session.userId;
    res.render("shippingInfo", {
        userId: userId,
        user: await User.findById(userId),
    });
});

routes.post("/checkout/shipping-info", async (req, res) => {
    const {
        userId,
        name,
        phoneNumber,
        email,
        state,
        country,
        city,
        address,
        pincode,
    } = req.body;

    // Basic validation
    if (!userId || !name || !phoneNumber || !email || !state || !country || !city || !address || !pincode) {
        return res.status(400).send("All fields are required.");
    }

    try {
        const checkout = await Checkout.findOne({ userId: userId });

        if (!checkout) {
            // Create new checkout info
            const item = new Checkout({
                userId,
                name,
                address,
                city,
                state,
                country,
                pinCode: pincode,
                payMethod: "Not Specified",
                email,
                phoneNumber,
            });
            await item.save();
        } else {
            // Update existing checkout info
            await Checkout.updateOne(
                { userId },
                {
                    $set: {
                        name,
                        address,
                        city,
                        state,
                        country,
                        pinCode: pincode,
                        payMethod: "Not Specified",
                        email,
                        phoneNumber,
                    },
                }
            );
        }
        res.redirect(`/checkout/payment?UserID=${userId}`);
    } catch (error) {
        console.error("Error saving customer information:", error);
        res.status(500).send("Error saving customer information");
    }
});

routes.post("/create-order", async (req, res) => {
    const { currency, receipt } = req.body;
    const userId = req.session.userId;
    try {
        console.log('Razorpay version:', Razorpay.version);
        const cartItems = await CartItem.find({ userId }).populate("productId");
        let shippingCharges = 100;
        let subTotal = 0;
        cartItems.forEach((item) => {
            subTotal += item.productId.sellingPrice * item.quantity;
        });
        const customer = await Checkout.findOne({ userId });
        if (
            customer &&
            customer.state === "MH" &&
            customer.city === "Amravati"
        ) {
            shippingCharges = 0;
        }
        const total = subTotal + shippingCharges;

        try {
            const order = await razorpay.orders.create({
                amount: total * 100,
                currency,
                receipt,
                payment_capture: "1",
            });
            console.log("Razorpay order created:", order);

            res.json(order);
        } catch (error) {
            res.status(500).send({ error: error.message });
        }
    } catch (error) {
        // The missing catch block is added here
        res.status(500).send({
            error: "Error processing order",
            details: error.message,
        });
    }
});

routes.post("/verifyOrder", async (req, res) => {
    const { order_id, payment_id } = req.body;
    const razorpay_signature = req.headers["x-razorpay-signature"];
    const key_secret = process.env.RAZORPAY_SECRET_KEY;
    let hmac = crypto.createHmac("sha256", key_secret);
    hmac.update(order_id + "|" + payment_id);
    const generated_signature = hmac.digest("hex");

    if (razorpay_signature === generated_signature) {
        try {
            const userId = req.session.userId;
            const cartItems = await CartItem.find({ userId }).populate("productId");

            if (!cartItems || cartItems.length === 0) {
                throw new Error("No items found in cart");
            }

            const customer = await Checkout.findOne({ userId });
            if (!customer) {
                throw new Error("Customer information not found");
            }

            // Calculate total amount
            const totalAmount = cartItems.reduce(
                (total, item) => total + (item.productId.sellingPrice * item.quantity),
                0
            );

            // Create order with full details
            // Check inventory for all items
            for (const item of cartItems) {
                const product = await Product.findById(item.productId._id);
                if (!product || product.inventory < item.quantity) {
                    throw new Error(`Not enough inventory for product: ${product.productName}`);
                }
            }

            // Update inventory
            for (const item of cartItems) {
                await Product.findByIdAndUpdate(
                    item.productId._id,
                    { $inc: { inventory: -item.quantity } }
                );
            }

            // Group cart items by seller
            const itemsBySeller = {};
            cartItems.forEach(item => {
                const sellerId = item.productId.sellerID;
                if (!itemsBySeller[sellerId]) {
                    itemsBySeller[sellerId] = [];
                }
                itemsBySeller[sellerId].push(item);
            });

            // Create main order
            const order = new Order({
                userId,
                items: cartItems.map(item => ({
                    productId: item.productId._id,
                    quantity: item.quantity,
                    price: item.productId.sellingPrice
                })),
                totalAmount,
                shippingAddress: {
                    address: customer.address,
                    city: customer.city,
                    state: customer.state,
                    country: customer.country,
                    pincode: customer.pinCode
                },
                status: "processing",
                orderedAt: new Date(),
                paymentMethod: "online",
                paymentId: payment_id,
            });

            // Save main order
            const savedOrder = await order.save();
            if (!savedOrder) {
                throw new Error("Failed to save order");
            }

            // Create sub-orders for each seller
            for (const [sellerId, items] of Object.entries(itemsBySeller)) {
                const subOrderTotal = items.reduce((sum, item) => 
                    sum + (item.quantity * item.productId.price), 0);
                
                // Calculate deadline (3 days from now)
                const deadline = new Date();
                deadline.setDate(deadline.getDate() + 3);

                const subOrder = new SubOrder({
                    mainOrderId: savedOrder._id,
                    sellerId: sellerId,
                    items: items.map(item => ({
                        productId: item.productId._id,
                        quantity: item.quantity,
                        price: item.productId.price
                    })),
                    totalAmount: subOrderTotal,
                    status: "processing",
                    deadline: deadline,
                    shippingStatus: "pending"
                });
                await subOrder.save();
            }

            await CartItem.deleteMany({ userId });


            // Fetch user and sellers for emails
            const user = await User.findById(userId);
            const sellersMap = {};
            for (const item of cartItems) {
                if (!sellersMap[item.productId.sellerID]) {
                    sellersMap[item.productId.sellerID] = await Seller.findById(item.productId.sellerID);
                }
            }

            // --- 1. Email to User ---
            const orderItemsHtml = cartItems.map(item => `
                <tr>
                    <td>${item.productId.productName}</td>
                    <td>${item.quantity}</td>
                    <td>₹${item.productId.sellingPrice}</td>
                    <td>₹${item.productId.sellingPrice * item.quantity}</td>
                </tr>
            `).join('');

            const userMail = {
                from: '"Shilp India" <shilpindia25@gmail.com>',
                to: user.email,
                subject: 'Your Order is Confirmed! 🎉',
                html: `
                    <div style="font-family:Montserrat,sans-serif;max-width:600px;margin:auto;">
                        <h2 style="color:#5B1F1F;">Thank you for your order, ${user.name}!</h2>
                        <p>Your order <b>#${savedOrder._id}</b> has been placed successfully.</p>
                        <h3>Order Details:</h3>
                        <table border="1" style="border-collapse:collapse;width:100%;">
                            <tr>
                                <th>Product</th><th>Qty</th><th>Price</th><th>Total</th>
                            </tr>
                            ${orderItemsHtml}
                        </table>
                        <p><b>Total Amount:</b> ₹${savedOrder.totalAmount}</p>
                        <p><b>Shipping Address:</b><br>
                            ${customer.address}, ${customer.city}, ${customer.state}, ${customer.country} - ${customer.pinCode}
                        </p>
                        <p>We will notify you when your order is shipped.<br>Thank you for shopping with Shilp India!</p>
                    </div>
                `
            };
            transporter.sendMail(userMail, (err) => {
                if (err) console.error("Error sending order confirmation to user:", err);
            });

            // --- 2. Email to Sellers for their Suborders ---
            const subOrders = await SubOrder.find({ mainOrderId: savedOrder._id }).populate('items.productId');
            for (const subOrder of subOrders) {
                const seller = sellersMap[subOrder.sellerId];
                if (!seller) continue;
                const subOrderItemsHtml = subOrder.items.map(item => `
                    <tr>
                        <td>${item.productId.productName}</td>
                        <td>${item.quantity}</td>
                        <td>₹${item.price}</td>
                        <td>₹${item.price * item.quantity}</td>
                    </tr>
                `).join('');
                const sellerMail = {
                    from: '"Shilp India" <shilpindia25@gmail.com>',
                    to: seller.email,
                    subject: `New Order Received! Order #${savedOrder._id}`,
                    html: `
                        <div style="font-family:Montserrat,sans-serif;max-width:600px;margin:auto;">
                            <h2 style="color:#e75480;">You have a new order!</h2>
                            <p>Order <b>#${savedOrder._id}</b> has been placed and includes your products.</p>
                            <h3>Suborder Details:</h3>
                            <table border="1" style="border-collapse:collapse;width:100%;">
                                <tr>
                                    <th>Product</th><th>Qty</th><th>Price</th><th>Total</th>
                                </tr>
                                ${subOrderItemsHtml}
                            </table>
                            <p><b>Total for you:</b> ₹${subOrder.totalAmount}</p>
                            <p>Please process and ship the order by <b>${subOrder.deadline.toLocaleDateString()}</b>.</p>
                        </div>
                    `
                };
                transporter.sendMail(sellerMail, (err) => {
                    if (err) console.error(`Error sending order email to seller ${seller.email}:`, err);
                });
            }

            // --- 3. Email to Admin ---
            const subOrdersHtml = subOrders.map(subOrder => {
                const seller = sellersMap[subOrder.sellerId];
                const itemsHtml = subOrder.items.map(item => `
                    <tr>
                        <td>${item.productId.productName}</td>
                        <td>${item.quantity}</td>
                        <td>₹${item.price}</td>
                        <td>₹${item.productId.sellingPrice}</td>
                        <td>₹${item.price * item.quantity}</td>
                    </tr>
                `).join('');
                return `
                    <h4>Seller: ${seller ? seller.shopName : subOrder.sellerId}</h4>
                    <table border="1" style="border-collapse:collapse;width:100%;margin-bottom:10px;">
                        <tr>
                            <th>Product</th><th>Qty</th><th>Price</th><th>Selling Price</th><th>Total</th>
                        </tr>
                        ${itemsHtml}
                    </table>
                    <b>Suborder Total:</b> ₹${subOrder.totalAmount}<br>
                    <b>Deadline:</b> ${subOrder.deadline.toLocaleDateString()}<br>
                    <hr>
                `;
            }).join('');

            const adminMail = {
                from: '"Shilp India" <shilpindia25@gmail.com>',
                to: 'shilpindia25@gmail.com', // your admin email
                subject: `New Order Placed: #${savedOrder._id}`,
                html: `
                    <div style="font-family:Montserrat,sans-serif;max-width:700px;margin:auto;">
                        <h2>New Order Placed</h2>
                        <h3>User Details:</h3>
                        <p>
                            <b>Name:</b> ${user.name}<br>
                            <b>Email:</b> ${user.email}<br>
                            <b>Phone:</b> ${user.number}<br>
                            <b>Shipping Address:</b> ${customer.address}, ${customer.city}, ${customer.state}, ${customer.country} - ${customer.pinCode}
                        </p>
                        <h3>Order Details:</h3>
                        <table border="1" style="border-collapse:collapse;width:100%;">
                            <tr>
                                <th>Product</th><th>Qty</th><th>Price</th><th>Total</th>
                            </tr>
                            ${orderItemsHtml}
                        </table>
                        <p><b>Total Amount:</b> ₹${savedOrder.totalAmount}</p>
                        <h3>Suborders:</h3>
                        ${subOrdersHtml}
                    </div>
                `
            };
            transporter.sendMail(adminMail, (err) => {
                if (err) console.error("Error sending order confirmation to admin:", err);
            });


            res.json({
                success: true,
                message: "Payment has been verified and order created",
                orderId: savedOrder._id,
                redirectUrl: '/success'
            });
        } catch (error) {
            console.error("Error creating order:", error);
            res.status(500).json({
                success: false,
                message: "Error creating order",
                errorDetails: error.message //add more details for debugging
            });
        }
    } else {
        res.json({ success: false, message: "Payment verification failed" });
    }
});

// Success page route
routes.get('/success', isAuthenticated, async (req, res) => {
    try {
        const orderId = req.query.orderId;
        if (!orderId){
            return res.render('success', {error: 'Order not found'});
        }
        const order = await Order.findById(orderId).populate('items.productId');
        if (!order) {
            return res.render('success', {error: 'Order not found'});
        }
        res.render('success', { order });
    } catch (error) {
        console.error('Error rendering success page: ', error);
        res.status(500).send('Error rendering success page')
    }
});

routes.post("/create-cod-order", isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const cartItems = await CartItem.find({ userId }).populate("productId");

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ success: false, message: "No items found in cart" });
        }

        const customer = await Checkout.findOne({ userId });
        if (!customer) {
            return res.status(400).json({ success: false, message: "Customer information not found" });
        }

        // Calculate total amount
        let shippingCharges = 100;
        if (customer.state === "MH" && customer.city === "Amravati") {
            shippingCharges = 0;
        }
        const totalAmount = cartItems.reduce(
            (total, item) => total + (item.productId.sellingPrice * item.quantity),
            0
        ) + shippingCharges;

        // Check inventory for all items
        for (const item of cartItems) {
            const product = await Product.findById(item.productId._id);
            if (!product || product.inventory < item.quantity) {
                return res.status(400).json({ success: false, message: `Not enough inventory for product: ${product.productName}` });
            }
        }

        // Update inventory
        for (const item of cartItems) {
            await Product.findByIdAndUpdate(
                item.productId._id,
                { $inc: { inventory: -item.quantity } }
            );
        }

        // Group cart items by seller
        const itemsBySeller = {};
        cartItems.forEach(item => {
            const sellerId = item.productId.sellerID;
            if (!itemsBySeller[sellerId]) {
                itemsBySeller[sellerId] = [];
            }
            itemsBySeller[sellerId].push(item);
        });

        // Create main order
        const order = new Order({
            userId,
            items: cartItems.map(item => ({
                productId: item.productId._id,
                quantity: item.quantity,
                price: item.productId.sellingPrice
            })),
            totalAmount,
            shippingAddress: {
                address: customer.address,
                city: customer.city,
                state: customer.state,
                country: customer.country,
                pincode: customer.pinCode
            },
            status: "processing",
            orderedAt: new Date(),
            paymentMethod: "cod"
        });

        // Save main order
        const savedOrder = await order.save();
        if (!savedOrder) {
            return res.status(500).json({ success: false, message: "Failed to save order" });
        }

        // Create sub-orders for each seller
        for (const [sellerId, items] of Object.entries(itemsBySeller)) {
            const subOrderTotal = items.reduce((sum, item) => 
                sum + (item.quantity * item.productId.price), 0);
            
            // Calculate deadline (3 days from now)
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + 3);

            const subOrder = new SubOrder({
                mainOrderId: savedOrder._id,
                sellerId: sellerId,
                items: items.map(item => ({
                    productId: item.productId._id,
                    quantity: item.quantity,
                    price: item.productId.price
                })),
                totalAmount: subOrderTotal,
                status: "processing",
                deadline: deadline,
                shippingStatus: "pending"
            });
            await subOrder.save();
        }

        await CartItem.deleteMany({ userId });

        // Fetch user and sellers for emails
        const user = await User.findById(userId);
        const sellersMap = {};
        for (const item of cartItems) {
            if (!sellersMap[item.productId.sellerID]) {
                sellersMap[item.productId.sellerID] = await Seller.findById(item.productId.sellerID);
            }
        }

        // --- 1. Email to User ---
        const orderItemsHtml = cartItems.map(item => `
            <tr>
                <td>${item.productId.productName}</td>
                <td>${item.quantity}</td>
                <td>₹${item.productId.sellingPrice}</td>
                <td>₹${item.productId.sellingPrice * item.quantity}</td>
            </tr>
        `).join('');

        const userMail = {
            from: '"Shilp India" <shilpindia25@gmail.com>',
            to: user.email,
            subject: 'Your Order is Confirmed! 🎉',
            html: `
                <div style="font-family:Montserrat,sans-serif;max-width:600px;margin:auto;">
                    <h2 style="color:#5B1F1F;">Thank you for your order, ${user.name}!</h2>
                    <p>Your order <b>#${savedOrder._id}</b> has been placed successfully.</p>
                    <h3>Order Details:</h3>
                    <table border="1" style="border-collapse:collapse;width:100%;">
                        <tr>
                            <th>Product</th><th>Qty</th><th>Price</th><th>Total</th>
                        </tr>
                        ${orderItemsHtml}
                    </table>
                    <p><b>Total Amount:</b> ₹${savedOrder.totalAmount}</p>
                    <p><b>Shipping Address:</b><br>
                        ${customer.address}, ${customer.city}, ${customer.state}, ${customer.country} - ${customer.pinCode}
                    </p>
                    <p>We will notify you when your order is shipped.<br>Thank you for shopping with Shilp India!</p>
                </div>
            `
        };
        transporter.sendMail(userMail, (err) => {
            if (err) console.error("Error sending order confirmation to user:", err);
        });

        // --- 2. Email to Sellers for their Suborders ---
        const subOrders = await SubOrder.find({ mainOrderId: savedOrder._id }).populate('items.productId');
        for (const subOrder of subOrders) {
            const seller = sellersMap[subOrder.sellerId];
            if (!seller) continue;
            const subOrderItemsHtml = subOrder.items.map(item => `
                <tr>
                    <td>${item.productId.productName}</td>
                    <td>${item.quantity}</td>
                    <td>₹${item.price}</td>
                    <td>₹${item.price * item.quantity}</td>
                </tr>
            `).join('');
            const sellerMail = {
                from: '"Shilp India" <shilpindia25@gmail.com>',
                to: seller.email,
                subject: `New Order Received! Order #${savedOrder._id}`,
                html: `
                    <div style="font-family:Montserrat,sans-serif;max-width:600px;margin:auto;">
                        <h2 style="color:#e75480;">You have a new order!</h2>
                        <p>Order <b>#${savedOrder._id}</b> has been placed and includes your products.</p>
                        <h3>Suborder Details:</h3>
                        <table border="1" style="border-collapse:collapse;width:100%;">
                            <tr>
                                <th>Product</th><th>Qty</th><th>Price</th><th>Total</th>
                            </tr>
                            ${subOrderItemsHtml}
                        </table>
                        <p><b>Total for you:</b> ₹${subOrder.totalAmount}</p>
                        <p>Please process and ship the order by <b>${subOrder.deadline.toLocaleDateString()}</b>.</p>
                    </div>
                `
            };
            transporter.sendMail(sellerMail, (err) => {
                if (err) console.error(`Error sending order email to seller ${seller.email}:`, err);
            });
        }

        // --- 3. Email to Admin ---
        const subOrdersHtml = subOrders.map(subOrder => {
            const seller = sellersMap[subOrder.sellerId];
            const itemsHtml = subOrder.items.map(item => `
                <tr>
                    <td>${item.productId.productName}</td>
                    <td>${item.quantity}</td>
                    <td>₹${item.price}</td>
                    <td>₹${item.productId.sellingPrice}</td>
                    <td>₹${item.price * item.quantity}</td>
                </tr>
            `).join('');
            return `
                <h4>Seller: ${seller ? seller.shopName : subOrder.sellerId}</h4>
                <table border="1" style="border-collapse:collapse;width:100%;margin-bottom:10px;">
                    <tr>
                        <th>Product</th><th>Qty</th><th>Price</th><th>Selling Price</th><th>Total</th>
                    </tr>
                    ${itemsHtml}
                </table>
                <b>Suborder Total:</b> ₹${subOrder.totalAmount}<br>
                <b>Deadline:</b> ${subOrder.deadline.toLocaleDateString()}<br>
                <hr>
            `;
        }).join('');

        const adminMail = {
            from: '"Shilp India" <shilpindia25@gmail.com>',
            to: 'shilpindia25@gmail.com', // your admin email
            subject: `New Order Placed: #${savedOrder._id}`,
            html: `
                <div style="font-family:Montserrat,sans-serif;max-width:700px;margin:auto;">
                    <h2>New Order Placed</h2>
                    <h3>User Details:</h3>
                    <p>
                        <b>Name:</b> ${user.name}<br>
                        <b>Email:</b> ${user.email}<br>
                        <b>Phone:</b> ${user.number}<br>
                        <b>Payment Type:</b> ${savedOrder.paymentMethod}<br>
                        <b>Payment ID:</b> ${savedOrder.paymentId}<br>
                        <b>Shipping Address:</b> ${customer.address}, ${customer.city}, ${customer.state}, ${customer.country} - ${customer.pinCode}
                    </p>
                    <h3>Order Details:</h3>
                    <table border="1" style="border-collapse:collapse;width:100%;">
                        <tr>
                            <th>Product</th><th>Qty</th><th>Price</th><th>Total</th>
                        </tr>
                        ${orderItemsHtml}
                    </table>
                    <p><b>Total Amount:</b> ₹${savedOrder.totalAmount}</p>
                    <h3>Suborders:</h3>
                    ${subOrdersHtml}
                </div>
            `
        };
        transporter.sendMail(adminMail, (err) => {
            if (err) console.error("Error sending order confirmation to admin:", err);
        });

        res.json({
            success: true,
            message: "Order placed successfully",
            orderId: savedOrder._id,
            redirectUrl: '/success'
        });
    } catch (error) {
        console.error("Error creating COD order:", error);
        res.status(500).json({
            success: false,
            message: "Error creating COD order",
            errorDetails: error.message
        });
    }
});

// Show Help Page
routes.get('/help', (req, res) => {
    res.render('help');
});

routes.get('/policies', (req, res) => {
    res.render('policies');
});

routes.post('/help/contact', async (req, res) => {
    const { name, email, message } = req.body;

    // Setup Nodemailer transporter (your support email credentials)
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SHILP_EMAIL_USER, // your email
            pass: process.env.SHILP_EMAIL_PASS  // your app password 
        }
    });

    // Mail to you (admin/support)
    const adminMail = {
        from: `"${name}" <${email}>`,  // Looks like from user
        to: 'shilpindia25@gmail.com', // Where you receive the queries
        subject: `New Contact Query from ${name}`,
        text: message,
        html: `<p><strong>From:</strong> ${name} (${email})</p><p><strong>Message:</strong></p><p>${message}</p>`
    };

    // Confirmation mail to user
    const userMail = {
        from: '"Shilp India" shilpindia25@gmail.com', // From your brand
        to: email,
        subject: 'We have received your query!',
        html: `
            <p>Hi ${name},</p>
            <p>Thank you for reaching out. We’ve received your message and will get back to you shortly.</p>
            <hr />
            <p><strong>Your Message:</strong></p>
            <blockquote>${message}</blockquote>
            <hr />
            <p>Regards,<br>Team Shilp India</p>
        `
    };

    try {
        await transporter.sendMail(adminMail);
        await transporter.sendMail(userMail);
        res.status(200).json({ success: true, message: 'Message sent and confirmation mailed.' });
    } catch (error) {
        console.error('Email Error:', error);
        res.status(500).json({ success: false, message: 'Could not send email.' });
    }
});


module.exports = routes;