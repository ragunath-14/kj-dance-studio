const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  studentName: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters']
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
  whatsappNumber: { type: String, trim: true },
  danceStyle: { type: String, trim: true },
  danceForFitness: { type: String, trim: true },
  classType: {
    type: String,
    enum: {
      values: ['Regular Class', 'Summer Class', 'Fitness Class'],
      message: '{VALUE} is not a valid class type'
    },
    default: 'Regular Class'
  },
  studentCategory: { type: String, enum: ['Adults', 'Kids'], trim: true },
  studentAge: { type: String, trim: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], trim: true },
  isActive: { type: Boolean, default: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true }
});

// Explicitly use 'students' collection to share data with registration backend
module.exports = mongoose.model('Student', StudentSchema, 'students');
