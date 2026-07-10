/**
 * Migration: Backfill forMonth / forYear on existing Monthly Fee payments.
 *
 * For each Payment where:
 *   - purpose === 'Monthly Fee'
 *   - forMonth or forYear is missing/null
 *
 * We set forMonth = payment.date.getMonth()
 *         forYear  = payment.date.getFullYear()
 *
 * Run once:  node scripts/migratePaymentMonths.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Payment  = require('../models/Payment');

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');

  // Find all Monthly Fee payments missing forMonth or forYear
  const payments = await Payment.find({
    purpose: 'Monthly Fee',
    $or: [
      { forMonth: { $exists: false } },
      { forMonth: null },
      { forYear:  { $exists: false } },
      { forYear:  null }
    ]
  }).lean();

  console.log(`📋 Found ${payments.length} payments to backfill`);

  let updated = 0;
  let errors  = 0;

  for (const p of payments) {
    try {
      const d = new Date(p.date || p.createdAt || Date.now());
      await Payment.updateOne(
        { _id: p._id },
        { $set: { forMonth: d.getMonth(), forYear: d.getFullYear() } }
      );
      updated++;
    } catch (err) {
      console.error(`  ❌ Failed for payment ${p._id}:`, err.message);
      errors++;
    }
  }

  console.log(`\n✅ Migration complete — Updated: ${updated} | Errors: ${errors}`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
