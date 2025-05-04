const express = require("express");
const mongoose = require("mongoose");
const routes = express.Router();
const Path = require("path");
const { urlencoded } = require("body-parser");
const bodyParser = require("body-parser");
const { Console, log } = require("console");
const session = require("express-session");
require("dotenv").config();
const crypto = require("crypto"); // Added for HMAC

const User = require("../models/User");
const Order = require("../models/Order"); // Added Order model
const Product = require("../models/products");

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
        res.redirect("/");
    } catch (error) {
        res.render("login", { error: "An error occurred" });
    }
});

routes.get("/signup", (req, res) => {
    res.render("signup");
});

routes.post("/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.render("signup", { error: "Email already exists" });
        }

        const user = new User({ name, email, password });
        await user.save();

        req.session.userId = user._id;
        res.redirect("/");
    } catch (error) {
        res.render("signup", { error: "An error occurred" });
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

routes.get("/", async (req, res) => {
    res.status(200).render("index", {
        Product: await Products.find(),
        user: req.session.userId
            ? await User.findById(req.session.userId)
            : null,
    });
});

routes.get("/product-details", async (req, res) => {
    const productId = req.query.id;
    try {
        const productArray = await Products.find({ _id: productId });
        const product = productArray[0];
        const keyPoints = product.keyPoints;
        const user = req.session.userId
            ? await User.findById(req.session.userId)
            : null;
        res.render("product-details", {
            product: productArray,
            keyPoints: keyPoints,
            user: user,
        });
    } catch (error) {
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
            total += item.productId.price * item.quantity;
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
            subTotal += item.productId.price * item.quantity;
        });
        const costumer = await Checkout.findOne({ userId: userId });
        if (
            costumer &&
            costumer.state == "Maharashtra" &&
            costumer.city == "Amravati"
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
    console.log(userId);
    const checkout = await Checkout.find({ userId: userId });

    if (checkout) {
        try {
            const item = new Checkout({
                userId: userId,
                name: name,
                address: address,
                city: city,
                state: state,
                country: country,
                pinCode: pincode,
                payMethod: "Not Specified",
                email: email,
                phoneNumber: phoneNumber,
            });
            const tempVar = await item.save();
            res.redirect(`/checkout/payment?UserID=${userId}`);
        } catch (error) {
            console.error("Error adding customer information:", error);
        }
    } else {
        try {
            const result = await Checkout.updateOne(
                { userId: userId },
                {
                    $set: {
                        userId: userId,
                        name: name,
                        address: address,
                        city: city,
                        state: state,
                        country: country,
                        pinCode: pincode,
                        payMethod: "Not Specified",
                        email: email,
                        phoneNumber: phoneNumber,
                    },
                },
            );

            if (result.matchedCount > 0) {
                console.log("Customer information updated successfully.");
            } else {
                console.log("No customer found with the specified userId.");
            }
            res.redirect(`/checkout/payment?UserID=${userId}`);
        } catch (error) {
            console.error("Error updating customer information:", error);
        }
    }
});

routes.post("/create-order", async (req, res) => {
    const { currency, receipt } = req.body;
    const userId = req.session.userId;
    try {
        const cartItems = await CartItem.find({ userId }).populate("productId");
        let shippingCharges = 100;
        let subTotal = 0;
        cartItems.forEach((item) => {
            subTotal += item.productId.price * item.quantity;
        });
        const customer = await Checkout.findOne({ userId });
        if (
            customer &&
            customer.state === "Maharashtra" &&
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
                (total, item) => total + (item.productId.price * item.quantity),
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
                    price: item.productId.price
                })),
                totalAmount,
                shippingAddress: `${customer.address}, ${customer.city}, ${customer.state}, ${customer.pinCode}`,
                status: "processing",
                orderedAt: new Date()
            });

            // Save main order
            const savedOrder = await order.save();
            if (!savedOrder) {
                throw new Error("Failed to save order");
            }

            // Create sub-orders for each seller
            const SubOrder = require('../models/SubOrder');
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

module.exports = routes;
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