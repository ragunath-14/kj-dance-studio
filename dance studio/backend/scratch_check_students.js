const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Student = require('./models/Student');
const Payment = require('./models/Payment');

const getMonthlyFee = (classType) => classType === 'Fitness Class' ? 2500 : 3500;

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('🔍 Inspecting Student & Payment Records...');
    const students = await Student.find().lean();
    const payments = await Payment.find().lean();
    
    console.log(`\nFound ${students.length} students and ${payments.length} payments.`);
    
    const paymentsByStudent = new Map();
    for (const p of payments) {
      const sid = p.studentId?.toString();
      if (sid) {
        paymentsByStudent.set(sid, (paymentsByStudent.get(sid) || 0) + (p.amount || 0));
      }
    }
    
    const today = new Date();
    
    students.forEach((s, idx) => {
      const joinDate = new Date(s.createdAt || s.joinDate);
      const fee = getMonthlyFee(s.classType);
      const paid = paymentsByStudent.get(s._id.toString()) || 0;
      
      let totalCycles = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth()) + 1;
      if (today.getDate() < joinDate.getDate()) {
        totalCycles--;
      }
      
      const totalExpected = s.isActive !== false ? (totalCycles * fee) : 0;
      const due = Math.max(0, totalExpected - paid);
      
      console.log(`\n[Student #${idx + 1}]`);
      console.log(`- Name: ${s.studentName}`);
      console.log(`- Phone: ${s.phone}`);
      console.log(`- WhatsApp: ${s.whatsappNumber || '(Same)'}`);
      console.log(`- Joined: ${joinDate.toDateString()}`);
      console.log(`- Class Type: ${s.classType} (Fee: ₹${fee}/mo)`);
      console.log(`- Active: ${s.isActive !== false}`);
      console.log(`- Total Paid: ₹${paid}`);
      console.log(`- Months Elapsed: ${totalCycles}`);
      console.log(`- Expected Fees: ₹${totalExpected}`);
      console.log(`- Total Due: ₹${due}`);
      console.log(`- Last Alert Sent: ${s.lastAlertSent ? new Date(s.lastAlertSent).toDateString() : 'Never'}`);
    });
    
    await mongoose.connection.close();
  })
  .catch(err => {
    console.error(err);
  });
