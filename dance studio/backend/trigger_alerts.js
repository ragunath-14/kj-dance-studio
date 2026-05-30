const mongoose = require('mongoose');
const { runPendingFeeAlerts } = require('./scheduler');
require('dotenv').config();

async function trigger() {
  try {
    console.log('🚀 Manually triggering student fee alerts...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    await runPendingFeeAlerts();
    
    console.log('✅ Manual trigger complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error triggering alerts:', err);
    process.exit(1);
  }
}

trigger();
