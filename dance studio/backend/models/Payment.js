const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student reference is required'],
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [1, 'Amount must be at least ₹1']
  },
  date:          { type: Date, default: Date.now },
  method:        { type: String, trim: true },
  purpose:       { type: String, trim: true, index: true },
  remainingFees: { type: Number, default: 0, min: 0 }
});

module.exports = mongoose.model('Payment', PaymentSchema);
