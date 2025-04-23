const express = require('express');
const mongoose = require('mongoose');
const routes = express.Router();
const Path = require('path');
const { urlencoded } = require('body-parser');
const bodyParser = require('body-parser');
const { Console, log } = require('console');
const session = require('express-session');
require('dotenv').config();

const User = require('../models/User');

routes.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));

// Authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
};

routes.get('/login', (req, res) => {
    res.render('login');
});

routes.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await user.comparePassword(password))) {
            return res.render('login', { error: 'Invalid email or password' });
        }

        req.session.userId = user._id;
        res.redirect('/');
    } catch (error) {
        res.render('login', { error: 'An error occurred' });
    }
});

routes.get('/signup', (req, res) => {
    res.render('signup');
});

routes.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.render('signup', { error: 'Email already exists' });
        }

        const user = new User({ name, email, password });
        await user.save();

        req.session.userId = user._id;
        res.redirect('/');
    } catch (error) {
        res.render('signup', { error: 'An error occurred' });
    }
});

routes.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});
const Razorpay = require('razorpay'); 
const { RAZORPAY_ID_KEY, RAZORPAY_SECRET_KEY } = process.env;

const razorpay = new Razorpay({
    key_id: RAZORPAY_ID_KEY,
    key_secret: RAZORPAY_SECRET_KEY
});

//Models
const Products = require('../models/products')
const CartItem = require('../models/CartItem')
const Checkout = require('../models/Checkout')

routes.use(bodyParser.urlencoded({ extended: true }))
routes.use(bodyParser.json());
routes.use("/static",express.static("public"))

routes.get("/", async(req,res)=>{
    res.status(200).render("index",{
        Product : await Products.find(),
        user: req.session.userId ? await User.findById(req.session.userId) : null
    });
})

routes.get("/product-details", async (req, res) => {
    const productId = req.query.id;
    try {
        const productArray = await Products.find({ _id: productId });
        const product = productArray[0]; 
        const keyPoints = product.keyPoints;
        res.render('product-details', { product : productArray, keyPoints : keyPoints, user: req.session.userId ? await User.findById(req.session.userId) : null}); 
    } catch (error) {
        res.status(500).send('Product not found');
    }
})

routes.post("/cart", isAuthenticated, async (req, res) => {
    const productId = req.body.id;
    const userId = req.session.userId;
    try {
        let cartItem = await CartItem.findOne({ userId: userId, productId: productId });

        if (cartItem) {
          cartItem.quantity += 1;
          await cartItem.save();
        } else {
          cartItem = new CartItem({
            userId: userId,
            productId: productId,
            quantity: 1
          });
          await cartItem.save();
        }
        console.log("Added to cart");
        res.redirect('/cart');
      } catch (error) {
        console.error(error);
        res.status(500).send("Error adding to cart");
      }
})

routes.get('/cart', isAuthenticated, async (req, res) => {
    const userId = req.session.userId; 

    try {
      const cartItems = await CartItem.find({ userId: userId }).populate('productId');
      let total = 0;
        cartItems.forEach(item => {
            total += item.productId.price * item.quantity;
        });
        console.log(total);
        res.render('cart', {
            cartItems: cartItems,
            total: total,
            user: req.session.userId ? await User.findById(req.session.userId) : null
        });
    } catch (error) {
        console.error('Error fetching cart items:', error);
        res.status(500).send('Server Error');
    }
  });

  routes.post("/cart/update", isAuthenticated, async (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.session.userId;
    try {
        if (quantity <= 0) {
        await CartItem.deleteOne({ userId: userId, productId: productId });
        } else {
        await CartItem.findOneAndUpdate({ userId: userId, productId: productId }, { quantity });
        }
        res.redirect('/cart');
    } catch (error) {
        console.error(error);
        res.status(500).send("Error updating cart");
    }
  })

routes.get("/checkout/payment", async (req, res) => {
    userId = req.query.UserID
    try {
        const cartItems = await CartItem.find({ userId: userId }).populate('productId');
        let shippingCharges = 100
        let subTotal = 0;
          cartItems.forEach(item => {
              subTotal += item.productId.price * item.quantity;
          });
        const costumer = await Checkout.findOne({ userId: userId })
        if(costumer.state == "Maharashtra" && costumer.city == "Amravati"){
            shippingCharges = 0
        }
        total = subTotal + shippingCharges
          res.render('payment', {
              cartItems: cartItems,
              userId: userId,
              subTotal: subTotal,
              shippingCharges: shippingCharges,
              total: total,
              name: costumer.name,
              email: costumer.email,
              contact: costumer.phoneNumber,
              user: req.session.userId ? await User.findById(req.session.userId) : null
          });
      } catch (error) {
          console.error('Error fetching cart items:', error);
          res.status(500).send('Server Error');
      }
})

routes.get('/checkout/shipping-info', async (req, res) => {
    userId = req.query.UserID
    res.render('shippingInfo', {
        userId: userId,
        user: req.session.userId ? await User.findById(req.session.userId) : null
    })
})

routes.post('/checkout/shipping-info', async (req, res) => {
    const {userId, name, phoneNumber, email, state, country, city, address, pincode} = req.body
    console.log(userId)
    const checkout = await Checkout.find({ userId: userId })

    if(checkout){
        try{
            const item = new Checkout({
                userId: userId,
                name: name,
                address: address,
                city: city,
                state: state,
                country: country,
                pinCode: pincode,
                payMethod: 'Not Specified',
                email: email,
                phoneNumber: phoneNumber
            });
            const tempVar = await item.save();
            res.redirect(`/checkout/payment?UserID=${userId}`)
        } catch (error) {
            console.error('Error adding customer information:', error);
        }
    }
    else{
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
                        payMethod: 'Not Specified',
                        email: email,
                        phoneNumber: phoneNumber
                    }
                }
            );

            if (result.matchedCount > 0) {
                console.log('Customer information updated successfully.');
            } else {
                console.log('No customer found with the specified userId.');
            }
            res.redirect(`/checkout/payment?UserID=${userId}`)
        } catch (error) {
            console.error('Error updating customer information:', error);
        }

    }
})


routes.post('/create-order', async (req, res) => {
    const {currency, receipt, userId } = req.body;
    const cartItems = await CartItem.find({ userId: Number(userId) }).populate('productId');
        let shippingCharges = 100
        let subTotal = 0;
          cartItems.forEach(item => {
              subTotal += item.productId.price * item.quantity;
          });
        const costumer = await Checkout.find({ userId: Number(userId) })
        if(costumer.state == "Maharashtra" && costumer.city == "Amravati"){
            shippingCharges = 0
        }
        total = subTotal + shippingCharges

    try {
      const order = await razorpay.orders.create({
        amount: total * 100, 
        currency,
        receipt,
        payment_capture: '1', 
      });

      res.json(order);
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });

routes.post('/verifyOrder',  (req, res)=>{ 

    const {order_id, payment_id} = req.body;     
    const razorpay_signature =  req.headers['x-razorpay-signature'];

    const key_secret = process.env.RAZORPAY_SECRET_KEY;     

    let hmac = crypto.createHmac('sha256', key_secret); 

    hmac.update(order_id + "|" + payment_id);

    const generated_signature = hmac.digest('hex');


    if(razorpay_signature===generated_signature){
        res.json({success:true, message:"Payment has been verified"})
    }
    else
    res.json({success:false, message:"Payment verification failed"})
});

module.exports = routes;