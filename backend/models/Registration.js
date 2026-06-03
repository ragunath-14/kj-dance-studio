const mongoose = require('mongoose');

const RegistrationSchema = new mongoose.Schema({
  studentName: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters']
  },
  studentAge:     { type: String, trim: true },
  studentCategory: {
    type: String,
    enum: ['Kids', 'Adults'],
    default: 'Adults'
  },
  gender:         { type: String, enum: ['Male', 'Female', 'Other', ''], trim: true },
  bloodGroup:     { type: String, trim: true },
  classType: {
    type: String,
    enum: {
      values: ['Dance Class', 'Fitness Class', 'Regular Class', 'Online Class'],
      message: '{VALUE} is not a valid class type'
    },
    default: 'Dance Class'
  },
  danceStyle:     { type: String, trim: true },
  danceForFitness: { type: String, trim: true },
  whatsappNumber: { type: String, trim: true },
  location:       { type: String, trim: true },
  address:        { type: String, trim: true },
  parentName:     { type: String, trim: true },
  emergencyContactName: { type: String, trim: true },
  emergencyContactPhone: { type: String, trim: true },
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
      validator: function (v) {
        return /^[\d\s+\-()]{10,}$/.test(v);
      },
      message: 'Please enter a valid phone number (at least 10 digits)'
    },
    index: true
  },
  batchTiming:    { type: String, trim: true },
  notes:  { type: String, trim: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('Registration', RegistrationSchema, 'registrations');
