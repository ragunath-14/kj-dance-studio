const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  studentName: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function (v) {
        if (!v) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^[\d\s+\-()]{10,}$/.test(v);
      },
      message: 'Please enter a valid phone number (at least 10 digits)'
    },
    index: true
  },
  whatsappNumber: { type: String, trim: true },
  danceStyle: { type: String, trim: true },
  danceForFitness: { type: String, trim: true },
  classType: {
    type: String,
    enum: {
      values: ['Dance Class', 'Fitness Class', 'Regular Class'],
      message: '{VALUE} is not a valid class type'
    },
    default: 'Dance Class'
  },
  studentAge: { type: String, trim: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], trim: true },
  bloodGroup: { type: String, trim: true },
  parentName: { type: String, trim: true },
  emergencyContactName: { type: String, trim: true },
  emergencyContactPhone: { type: String, trim: true },
  location: { type: String, trim: true },
  address: { type: String, trim: true },
  batchTiming: { type: String, trim: true },
  notes: { type: String, trim: true },
  isActive: { type: Boolean, default: true, index: true },
  lastAlertSent: { type: Date },
  createdAt: { type: Date, default: Date.now, index: true }
});

// Explicitly use 'students' collection to share data with registration backend
module.exports = mongoose.model('Student', StudentSchema, 'students');
