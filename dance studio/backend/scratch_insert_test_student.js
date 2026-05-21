const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Student = require('./models/Student');

const mongoURI = process.env.MONGODB_URI;

mongoose.connect(mongoURI)
  .then(async () => {
    console.log('Inserting test student for the user to receive fee reminders...');
    
    // Check if student already exists to avoid duplicate
    const existing = await Student.findOne({ phone: '8610766098' });
    if (existing) {
      console.log('Student with phone 8610766098 already exists. Updating join date...');
      existing.createdAt = new Date('2026-04-10T00:00:00.000Z');
      existing.isActive = true;
      await existing.save();
      console.log('Updated existing student:', existing);
    } else {
      const newStudent = new Student({
        studentName: 'Ragu',
        phone: '8610766098',
        whatsappNumber: '8610766098',
        classType: 'Regular Class',
        isActive: true,
        createdAt: new Date('2026-04-10T00:00:00.000Z') // Overdue by 2 months
      });
      await newStudent.save();
      console.log('Successfully inserted new test student:', newStudent);
    }
    
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error inserting test student:', err);
    process.exit(1);
  });
