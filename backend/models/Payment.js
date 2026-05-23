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
  date:          { type: Date, default: Date.now, index: true },
  method:        { type: String, trim: true },
  purpose:       { type: String, trim: true },
  remainingFees: { type: Number, default: 0, min: 0 }
});

// Compound index: speeds up "total paid per student for Monthly Fee" queries
PaymentSchema.index({ studentId: 1, purpose: 1 });
// Index for monthly revenue queries (filter by date range)
PaymentSchema.index({ date: -1 });

module.exports = mongoose.model('Payment', PaymentSchema);
