/**
 * scripts/migrateClassSchedule.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time migration: set classSchedule = 'NA' on all existing Student and
 * Registration documents that don't already have the field set.
 *
 * Usage:
 *   node scripts/migrateClassSchedule.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dance-studio';

async function run() {
  try {
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Update Students collection
    const studentsResult = await db.collection('students').updateMany(
      { classSchedule: { $exists: false } },
      { $set: { classSchedule: 'NA' } }
    );
    console.log(`📚 Students updated: ${studentsResult.modifiedCount} documents`);

    // Update Registrations collection
    const registrationsResult = await db.collection('registrations').updateMany(
      { classSchedule: { $exists: false } },
      { $set: { classSchedule: 'NA' } }
    );
    console.log(`📋 Registrations updated: ${registrationsResult.modifiedCount} documents`);

    console.log('\n✅ Migration complete — all existing records now have classSchedule = "NA"');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

run();
