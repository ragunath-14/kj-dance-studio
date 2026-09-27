const mongoose = require('mongoose');

// Summer-camp sign-ups live in their own collection so they never appear in the
// Students / Payments / Attendance modules. Converting one creates a real Student.
const CampRegistrationSchema = new mongoose.Schema({
  studentName: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters']
  },
  studentAge: { type: String, trim: true },
  studentCategory: {
    type: String,
    enum: ['Kids', 'Adults'],
    default: 'Adults',
    index: true
  },
  gender: { type: String, enum: ['Male', 'Female', 'Other', ''], trim: true },
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
  status: {
    type: String,
    enum: ['registered', 'converted'],
    default: 'registered',
    index: true
  },
  convertedStudentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  convertedAt:        { type: Date },
  createdAt:          { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('CampRegistration', CampRegistrationSchema, 'camp_registrations');
