const mongoose = require('mongoose');

const studioSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    default: 'KJ Dance Studio'
  },
  address: {
    type: String,
    default: ''
  },
  contactNumber: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  socialLinks: {
    instagram: String,
    facebook: String,
    whatsapp: String
  },
  logoUrl: String,
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'kj studio' // Explicitly naming the collection as requested
});

module.exports = mongoose.model('Studio', studioSchema);
