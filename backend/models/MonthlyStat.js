const mongoose = require('mongoose');

const MonthlyStatSchema = new mongoose.Schema({
  monthId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  }, // Format: "YYYY-MM" (e.g., "2026-04")
  year: { type: Number, required: true },
  month: { type: Number, required: true }, // 1-12
  revenue: { type: Number, default: 0 },
  activeStudents: { type: Number, default: 0 },
  newJoiners: { type: Number, default: 0 },
  overdueAmount: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MonthlyStat', MonthlyStatSchema);
