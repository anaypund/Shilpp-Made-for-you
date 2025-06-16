const mongoose = require('mongoose');

const productSchema = mongoose.Schema({
    productName: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    actualPrice: {
        type: Number,
    },
    sellingPrice: {
        type: Number,
    },
    discount: {
        type: Number,
        required: false, // Optional field for products without discounts
        default: 0
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'], // Type of discount
        required: false, // Optional field for products without discounts
        default: 'percentage'
    },
    onSale: {
        type: Boolean,
        required: true,
        default: false
    },
    isActive: {
        type: Boolean,
        required: true,
        default: true // Indicates if the product is currently active/listed
    },
    isCustomizable: {
        type: Boolean,
        required: true,
        default: false // Indicates if the product can be customized
    },
    customizationLabel: {
        type: String,
        required: false, // Optional field for products that are not customizable
        default: 'Customize your product'
    },
    customizationType: {
        type: String,
        enum: ['none', 'image', 'text', 'both'], // Type of customization available
        required: false, // Optional field for products that are not customizable
        default: 'none'
    },
    customizeImage: {
        type: String,
        required: false, // Optional field for products that are not customizable
    },
    customizeText: {
        type: String,
        required: false, // Optional field for products that are not customizable
    },
    isVerified: {
        type: Boolean,
        required: true,
        default: false
    },
    category: {
        type: String,
        required: true,
    },
    subCategory: {
        type: String,
        required: true,
    },
    subSubCategory: {
        type: String,
        required: false, // Optional field for deeper categorization
    },

    imagePath: {
        type: String,
        required: true,
    },
    sellerID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller', // Assuming you have a Seller model
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    tags: {
        type: [String],
        required: true,
    },
    keyWords: {
        type: [String],
        required: true,
    },
    inventory: {
        type: Number,
        required: true,
        default: 0
    },
    width: {
        type: Number,
        required: true,
    },
    length: {
        type: Number,
        required: true,
    },
    height: {
        type: Number,
        required: false,
    },
    weight: {
        type: Number,
        required: false,
    },
    isHandmade: {
        type: Boolean,
        required: true,
    },
    material: {
        type: String,
        required: true,
    },
    otherSpecs: {
        type: String,
        required: false,
    },
    careInstructions: {
        type: String,
        required: false,
    },
    productImages: {
        type: [String], // Array of image file paths/URLs
        required: true,
    },
    productVideos: {
        type: [String], // Array of video file paths/URLs
        required: false,
    },
    adminRemarks: {
        type: [
            {
            text: String,
            date: Date
            }
        ],
        default: []
    }
}, {timestamps: true});

module.exports = mongoose.model('productSchema', productSchema);