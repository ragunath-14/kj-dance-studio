const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB for seeding');

    // Remove existing admin if any
    await User.deleteMany({ username: 'rishii' });
    await User.deleteMany({ username: 'admin' });

    const admin = new User({
      username: 'rishii',
      password: 'kj@123', // Storing as plain text as requested for simplicity, or we can add hashing later
      role: 'admin'
    });

    await admin.save();
    console.log('🚀 Admin user "rishii" created successfully!');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err.message);
    process.exit(1);
  }
};

seedAdmin();
