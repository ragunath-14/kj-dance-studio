const mongoose = require('mongoose');
require('dotenv').config();
const Student = require('./models/Student');
const Payment = require('./models/Payment');
const { runPendingFeeAlerts } = require('./scheduler');

async function testFeeAlert() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dance-studio';
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected.');

    // 1. Create a test student whose anniversary is TODAY
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);
    // Ensure the day of month matches today
    oneMonthAgo.setDate(today.getDate());

    console.log(`📝 Creating test student with join date: ${oneMonthAgo.toDateString()}...`);
    
    const testStudent = new Student({
      studentName: 'Test Alert Student',
      phone: '1234567890', // Replace with your number if you want to receive a real message
      whatsappNumber: '1234567890', 
      classType: 'Regular Class',
      isActive: true,
      createdAt: oneMonthAgo
    });

    await testStudent.save();
    console.log(`✅ Test student created: ${testStudent.studentName}`);

    // 2. Ensure they have NO payments (so they have dues)
    console.log('🔍 Running fee alert logic...');
    
    // We call the scheduler logic directly
    await runPendingFeeAlerts();

    console.log('\n✅ Logic execution complete. Check the logs above for "📡 Sending Twilio..."');
    console.log('Note: If Twilio is not configured, it will log "Would send to..." instead.');

    // 3. Cleanup
    console.log('\n🧹 Cleaning up test student...');
    await Student.deleteOne({ _id: testStudent._id });
    console.log('✅ Cleaned up.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error during test:', err);
    process.exit(1);
  }
}

testFeeAlert();
