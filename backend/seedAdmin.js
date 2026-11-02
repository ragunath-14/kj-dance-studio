// Creates (or replaces) the admin login.
//
//   ADMIN_SEED_USERNAME=youname ADMIN_SEED_PASSWORD='a-long-password' node seedAdmin.js
//
// The password is never kept in the code: it is read from the environment and stored hashed.
const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

const seedAdmin = async () => {
  const username = (process.env.ADMIN_SEED_USERNAME || 'rishii').trim();
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!password || password.length < 10) {
    console.error('❌ Set ADMIN_SEED_PASSWORD (at least 10 characters) before running this script.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB for seeding');

    // Replace the existing login with the same name, plus the old default "admin" account if it is still there
    await User.deleteMany({ username: { $in: [username, 'admin'] } });

    const admin = new User({ username, password, role: 'admin' });   // hashed by the model on save
    await admin.save();
    console.log(`🚀 Admin user "${username}" created successfully!`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err.message);
    process.exit(1);
  }
};

seedAdmin();
