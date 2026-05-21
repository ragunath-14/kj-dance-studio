const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Student = require('./models/Student');
const Payment = require('./models/Payment');

const mongoURI = process.env.MONGODB_URI;

mongoose.connect(mongoURI)
  .then(async () => {
    console.log('Resetting payments for student "Ragu" to test reminder alerts...');
    
    const student = await Student.findOne({ phone: '8610766098' });
    if (!student) {
      console.log('❌ Student with phone 8610766098 not found.');
      process.exit(1);
    }
    
    // Delete payments for this student
    const delResult = await Payment.deleteMany({ studentId: student._id });
    console.log(`🗑️ Deleted ${delResult.deletedCount} payments for student "${student.studentName}".`);
    
    // Clear lastAlertSent to allow testing fresh automated alerts as well
    student.lastAlertSent = undefined;
    await student.save();
    console.log('🔄 Cleared lastAlertSent timestamp for student.');
    
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error resetting payments:', err);
    process.exit(1);
  });
