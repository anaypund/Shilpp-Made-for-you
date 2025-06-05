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
    imagePath: {
        type: String,
        required: true,
    },
    sellerName: {
        type: String,
        required: true,
    },
    sellerID: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    keyPoints: {
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
    }
});

module.exports = mongoose.model('productSchema', productSchema);