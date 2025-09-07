const mongoose = require('mongoose');

const CMSSchema = new mongoose.Schema({
  indexPage: {
    bannerImage: {
        pc: {
            url: { type: String, required: true },
            alt: { type: String, required: false },
            tag: { type: String, required: true }
        },
        mobile: {
            url: { type: String, required: true },
            alt: { type: String, required: false },
            tag: { type: String, required: true }
        }
    }
  }
});

module.exports = mongoose.model('CMS', CMSSchema);
