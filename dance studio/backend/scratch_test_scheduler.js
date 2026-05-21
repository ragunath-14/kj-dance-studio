const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { runPendingFeeAlerts } = require('./scheduler');

const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error('❌ MONGODB_URI missing in .env');
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(async () => {
    console.log('✅ Connected to MongoDB. Running pending fee alerts dry run/live test...');
    await runPendingFeeAlerts();
    console.log('🏁 Completed. Closing MongoDB connection...');
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
