const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student reference is required'],
    index: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true
  },
  status: {
    type: String,
    enum: { values: ['Present', 'Absent'], message: '{VALUE} is not a valid attendance status' },
    required: [true, 'Status is required']
  },
  markedAt: { type: Date, default: Date.now }
});

// One attendance record per student per day
AttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema, 'attendance');
