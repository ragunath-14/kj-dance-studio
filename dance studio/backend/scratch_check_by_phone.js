const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoURI = process.env.MONGODB_URI;

mongoose.connect(mongoURI)
  .then(async () => {
    console.log('🔍 Searching registrations and students for phone numbers matching "8610"...');
    
    const db = mongoose.connection.db;
    
    const regs = await db.collection('registrations').find({
      $or: [
        { phone: { $regex: '8610' } },
        { whatsappNumber: { $regex: '8610' } }
      ]
    }).toArray();
    console.log(`Found ${regs.length} matching registrations:`, JSON.stringify(regs, null, 2));
    
    const students = await db.collection('students').find({
      $or: [
        { phone: { $regex: '8610' } },
        { whatsappNumber: { $regex: '8610' } }
      ]
    }).toArray();
    console.log(`Found ${students.length} matching students:`, JSON.stringify(students, null, 2));
    
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
