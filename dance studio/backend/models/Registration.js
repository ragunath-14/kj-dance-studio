const mongoose = require('mongoose');

const RegistrationSchema = new mongoose.Schema({
  studentName: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters']
  },
  studentCategory: { type: String, enum: ['Adults', 'Kids'], trim: true },
  studentAge: { type: String, trim: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], trim: true },
  classType: {
    type: String,
    enum: {
      values: ['Regular Class', 'Summer Class', 'Fitness Class'],
      message: '{VALUE} is not a valid class type'
    },
    default: 'Regular Class'
  },
  danceStyle: { type: String, trim: true },
  danceForFitness: { type: String, trim: true },
  whatsappNumber: { type: String, trim: true },
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
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('Registration', RegistrationSchema, 'registrations');
