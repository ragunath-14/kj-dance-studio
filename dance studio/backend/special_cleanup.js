const mongoose = require('mongoose');
require('dotenv').config();
const Student = require('./models/Student');
const Registration = require('./models/Registration');
const Payment = require('./models/Payment');

async function cleanup() {
  const mongoURI = process.env.MONGODB_URI;
  await mongoose.connect(mongoURI);
  console.log('🔗 Connected for specialized cleanup.');

  // 1. Remove placeholder students (Student 1, Student 2, or anything with 'Test')
  console.log('🧹 Removing placeholder/test students...');
  const studentDelete = await Student.deleteMany({ 
    $or: [
      { studentName: { $regex: '^Student \\d+$' } },
      { studentName: { $regex: 'Test', $options: 'i' } }
    ]
  });
  console.log(`✅ Deleted ${studentDelete.deletedCount} placeholder/test students.`);

  // 2. Remove test/redundant registrations
  console.log('🧹 Removing test/redundant registrations...');
  const regDelete = await Registration.deleteMany({
    $or: [
      { studentName: { $regex: 'Test', $options: 'i' } },
      { status: 'approved' } // Also remove approved ones as they are now Students
    ]
  });
  console.log(`✅ Deleted ${regDelete.deletedCount} test/approved registrations.`);

  // 3. Remove payments associated with deleted students
  console.log('🧹 Cleaning up orphaned payments...');
  const allPayments = await Payment.find().lean();
  let orphanedPayments = 0;
  for (const p of allPayments) {
    const studentExists = await Student.exists({ _id: p.studentId });
    if (!studentExists) {
      await Payment.deleteOne({ _id: p._id });
      orphanedPayments++;
    }
  }
  console.log(`✅ Deleted ${orphanedPayments} orphaned payments.`);

  console.log('\n✨ Specialized cleanup complete.');
  process.exit(0);
}

cleanup().catch(err => {
  console.error(err);
  process.exit(1);
});
