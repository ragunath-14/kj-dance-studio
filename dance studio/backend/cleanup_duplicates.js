const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Student = require('./models/Student');
const Payment = require('./models/Payment');

const cleanup = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in .env');

    await mongoose.connect(uri);
    console.log('CONNECTED: MongoDB for cleanup');

    // 1. CLEAN DUPLICATE STUDENTS
    // Logic: Same name and phone. Keep the oldest one (usually the first registered).
    console.log('\n--- PHASE 1: STUDENT CLEANUP ---');
    const duplicateGroups = await Student.aggregate([
      {
        $group: {
          _id: { 
            name: { $toLower: { $trim: { input: "$studentName" } } }, 
            phone: { $trim: { input: "$phone" } } 
          },
          docs: { $push: { id: "$_id", createdAt: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]);

    console.log(`Found ${duplicateGroups.length} groups of duplicate students.`);

    for (const group of duplicateGroups) {
      // Sort by creation date ascending, keep the first one
      const sorted = group.docs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const keepDoc = sorted[0];
      const deleteIds = sorted.slice(1).map(d => d.id);

      console.log(`Processing: "${group._id.name}" | Keeping: ${keepDoc.id}`);
      
      // Migrate payments before deleting
      const pUpdate = await Payment.updateMany(
        { studentId: { $in: deleteIds } },
        { $set: { studentId: keepDoc.id } }
      );
      if (pUpdate.modifiedCount > 0) {
        console.log(`  -> Migrated ${pUpdate.modifiedCount} payments to master record.`);
      }

      // Delete duplicates
      const sDelete = await Student.deleteMany({ _id: { $in: deleteIds } });
      console.log(`  -> Deleted ${sDelete.deletedCount} duplicates.`);
    }

    // 2. CLEAN DUPLICATE PAYMENTS
    // Logic: Same student, amount, purpose, and date.
    console.log('\n--- PHASE 2: PAYMENT CLEANUP ---');
    const allPayments = await Payment.find().sort({ createdAt: 1 });
    const seenPayments = new Set();
    const paymentsToDelete = [];

    for (const p of allPayments) {
      // Create a unique key for payment signature
      // We use the date part only (YYYY-MM-DD) to catch duplicates on the same day
      const dateKey = p.date ? new Date(p.date).toISOString().split('T')[0] : 'nodate';
      const key = `${p.studentId}_${p.amount}_${p.purpose}_${dateKey}`;
      
      if (seenPayments.has(key)) {
        paymentsToDelete.push(p._id);
      } else {
        seenPayments.add(key);
      }
    }

    if (paymentsToDelete.length > 0) {
      const pDelete = await Payment.deleteMany({ _id: { $in: paymentsToDelete } });
      console.log(`Deleted ${pDelete.deletedCount} duplicate payments.`);
    } else {
      console.log('No duplicate payments found.');
    }

    // 3. CLEAN DUPLICATE REGISTRATIONS
    console.log('\n--- PHASE 3: REGISTRATION CLEANUP ---');
    const Registration = require('./models/Registration');
    const duplicateRegs = await Registration.aggregate([
      {
        $group: {
          _id: { 
            name: { $toLower: { $trim: { input: "$studentName" } } }, 
            phone: { $trim: { input: "$phone" } } 
          },
          docs: { $push: "$_id" },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]);

    console.log(`Found ${duplicateRegs.length} groups of duplicate registrations.`);

    for (const group of duplicateRegs) {
      const [keepId, ...deleteIds] = group.docs;
      const rDelete = await Registration.deleteMany({ _id: { $in: deleteIds } });
      console.log(`  -> Deleted ${rDelete.deletedCount} duplicate registrations for "${group._id.name}".`);
    }

    console.log('\n✅ ALL DUPLICATES REMOVED SUCCESSFULLY');
    process.exit(0);
  } catch (err) {
    console.error('❌ CLEANUP ERROR:', err.message);
    process.exit(1);
  }
};

cleanup();
