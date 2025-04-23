const mongoose = require('mongoose');

const productSchema = mongoose.Schema({
    productName:{
        type: String,
        required: true,
    },
    price:{
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
        type: Array,
        required: true,
    },
    keyWords: {
        type: Array,
        required: true,
    },
})



module.exports = mongoose.model('productSchema', productSchema)