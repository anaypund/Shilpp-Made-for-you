const express = require('express');
const mongoose = require('mongoose');
const routes = express.Router();
const Path = require('path');
const { urlencoded } = require('body-parser');
const bodyParser = require('body-parser');
const { Console, log } = require('console');
require('dotenv').config()
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
    // Products.create([
    //     {
    //         productName: "Rose Agate Timepiece Resin Wall Clock",
    //         price: 1320,
    //         imagePath: "/static/images/Rose Agate Timepiece Resin Wall Clock.png",
    //         sellerName: "RT Dazzle Art",
    //         sellerID: "seller01",
    //         description: "Make a statement with our vibrant and colorful handmade resin wall clocks! Perfect for adding a pop of color to any room, or as a thoughtful gift for friends and family.",
    //         keyPoints: [
    //             "Handcrafted with care",
    //             "Material: Resin",
    //             "Size: 12 x 12 Inches",
    //             "Eco-friendly and sustainable"
    //         ],
    //         keyWords: ["clock", "resin", "wall clock", "beautiful"],
    //     },
    //     {
    //         productName: "Resin earring",
    //         price: 1320,
    //         imagePath: "/static/images/Resin earring.png",
    //         sellerName: "RT Dazzle Art",
    //         sellerID: "seller01",
    //         description: "Make a statement with our vibrant and colorful handmade resin wall clocks! Perfect for adding a pop of color to any room, or as a thoughtful gift for friends and family.",
    //         keyPoints: [
    //             "Handcrafted with care",
    //             "Material: Resin",
    //             "Size: 12 x 12 Inches",
    //             "Eco-friendly and sustainable"
    //         ],
    //         keyWords: ["clock", "resin", "wall clock", "beautiful"],
    //     },
    // ])
    res.status(200).render("index",{
        Product : await Products.find()
    });
})

routes.get("/product-details", async (req, res) => {
    const productId = req.query.id;
    try {
        const productArray = await Products.find({ _id: productId });
        const product = productArray[0]; // Access the first product document from the array
        const keyPoints = product.keyPoints;

        res.render('product-details', { product : productArray, keyPoints : keyPoints}); // Render a template for the product page
    } catch (error) {
        res.status(500).send('Product not found');
    }
})

routes.post("/cart", async (req, res) => {
    const productId = req.body.id
    const userId = 1
    try {
        // Check if item already exists in the cart for this user
        let cartItem = await CartItem.findOne({ userId: userId, productId: productId });
        
        if (cartItem) {
          // If item is already in the cart, increment the quantity
          cartItem.quantity += 1;
          await cartItem.save();
        } else {
          // Otherwise, create a new cart item
          cartItem = new CartItem({
            userId: userId,
            productId: productId,
            quantity: 1
          });
          await cartItem.save();
        }
        console.log("Added to cart")
        res.redirect('/cart'); // Redirect to the cart page
        res.status(200);
      } catch (error) {
        console.error(error);
        res.status(500).send("Error adding to cart");
      }
})

// routes/cart.js
routes.get('/cart', async (req, res) => {
    // const userId = req.session.userId; // Get the logged-in user's ID
    const userId = 1; // Get the logged-in user's ID
  
    try {
      // Populate cart items with product details
      const cartItems = await CartItem.find({ userId: userId }).populate('productId');
      let total = 0;
        cartItems.forEach(item => {
            total += item.productId.price * item.quantity;
        });
        console.log(total);
        res.render('cart', {
            cartItems: cartItems,
            total: total,
        });
    } catch (error) {
        console.error('Error fetching cart items:', error);
        res.status(500).send('Server Error');
    }
  });

  routes.post("/cart/update", async (req, res) => {
    const { productId, quantity } = req.body;
    const userId = 1
    try {
        if (quantity <= 0) {
        // Remove the item if quantity is 0
        await CartItem.deleteOne({ userId: userId, productId: productId });
        } else {
        // Otherwise, update the quantity
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
        // Populate cart items with product details
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
              contact: costumer.phoneNumber
          });
      } catch (error) {
          console.error('Error fetching cart items:', error);
          res.status(500).send('Server Error');
      }
})

routes.get('/checkout/shipping-info', async (req, res) => {
    userId = req.query.UserID
    res.render('shippingInfo', {
        userId: userId
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
            const result = await Customer.updateOne(
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
        amount: total * 100, // amount in the smallest currency unit
        currency,
        receipt,
        payment_capture: '1', // auto capture
      });
  
      res.json(order);
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });

routes.post('/verifyOrder',  (req, res)=>{ 
    
    // STEP 7: Receive Payment Data
    const {order_id, payment_id} = req.body;     
    const razorpay_signature =  req.headers['x-razorpay-signature'];

    // Pass yours key_secret here
    const key_secret = YAEUthsup8SijNs3iveeVlL1;     

    // STEP 8: Verification & Send Response to User
    
    // Creating hmac object 
    let hmac = crypto.createHmac('sha256', key_secret); 

    // Passing the data to be hashed
    hmac.update(order_id + "|" + payment_id);
    
    // Creating the hmac in the required format
    const generated_signature = hmac.digest('hex');
    
    
    if(razorpay_signature===generated_signature){
        res.json({success:true, message:"Payment has been verified"})
    }
    else
    res.json({success:false, message:"Payment verification failed"})
});

module.exports = routes;