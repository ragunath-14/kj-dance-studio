const Payment  = require('../models/Payment');
const Student  = require('../models/Student');
const whatsapp = require('../services/whatsappService');

// ─── Fee helper ──────────────────────────────────────────────────────────────
const getMonthlyFee = (classType) => classType === 'Fitness Class' ? 2500 : 3500;

// ─── GET /api/payments ───────────────────────────────────────────────────────
// ─── GET /api/payments (Paginated) ──────────────────────────────────────────
exports.getAllPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      Payment.find()
        .populate('studentId', 'studentName')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments()
    ]);

    res.json({
      data: payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('getAllPayments error:', err);
    res.status(500).json({ message: 'Failed to fetch payments.' });
  }
};

// ─── POST /api/payments ──────────────────────────────────────────────────────
exports.createPayment = async (req, res) => {
  try {
    const { studentId, amount } = req.body;

    if (!studentId)
      return res.status(400).json({ message: 'Student is required for payment.' });
    if (!amount || amount <= 0)
      return res.status(400).json({ message: 'A valid payment amount is required.' });

    const student = await Student.findById(studentId);
    if (!student)
      return res.status(404).json({ message: 'Student not found. Cannot record payment.' });

    // --- Prevent Duplicate Payments ---
    // Check if a payment with the same student, amount, purpose exists on the same day
    const paymentDate = new Date(req.body.date || Date.now());
    const startOfDay = new Date(paymentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(paymentDate);
    endOfDay.setHours(23, 59, 59, 999);

    const duplicatePayment = await Payment.findOne({
      studentId,
      amount,
      purpose: req.body.purpose,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (duplicatePayment) {
      return res.status(409).json({ 
        message: 'Duplicate detected: A payment for this student with the same amount and purpose is already recorded for this date.' 
      });
    }
    // ----------------------------------

    const payment    = new Payment(req.body);
    const newPayment = await payment.save();

    // Send WhatsApp Confirmation
    const whatsappNum = student.whatsappNumber || student.phone;
    if (whatsappNum) {
      whatsapp.sendPaymentConfirmation(
        whatsappNum,
        student.studentName,
        amount,
        req.body.purpose,
        new Date(payment.date || Date.now()).toLocaleDateString('en-IN')
      ).catch(err => console.error('Failed to send payment WhatsApp:', err.message));
    }

    // Return with student name populated
    await newPayment.populate('studentId', 'studentName');
    const io = req.app.get('socketio');
    if (io) io.emit('dataChanged', { type: 'payment', action: 'create' });

    res.status(201).json(newPayment);
  } catch (err) {
    if (err.name === 'ValidationError') {
      console.warn('⚠️ createPayment validation failed:', err.message);
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join('. ') });
    }
    if (err.name === 'CastError')
      return res.status(400).json({ message: 'Invalid student ID format.' });
    console.error('createPayment error:', err);
    res.status(500).json({ message: 'Server error. Could not record payment.' });
  }
};

// ─── PUT /api/payments/:id ───────────────────────────────────────────────────
exports.updatePayment = async (req, res) => {
  try {
    const updated = await Payment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('studentId', 'studentName');

    if (!updated) return res.status(404).json({ message: 'Payment not found.' });

    const io = req.app.get('socketio');
    if (io) io.emit('dataChanged', { type: 'payment', action: 'update' });

    res.json(updated);
  } catch (err) {
    if (err.name === 'ValidationError') {
      console.warn('⚠️ updatePayment validation failed:', err.message);
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join('. ') });
    }
    console.error('updatePayment error:', err);
    if (err.name === 'CastError')
      return res.status(400).json({ message: 'Invalid payment ID format.' });
    res.status(500).json({ message: 'Server error. Could not update payment.' });
  }
};

// ─── DELETE /api/payments/:id ────────────────────────────────────────────────
exports.deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found.' });

    const io = req.app.get('socketio');
    if (io) io.emit('dataChanged', { type: 'payment', action: 'delete' });

    res.json({ success: true, message: 'Payment deleted successfully.' });
  } catch (err) {
    console.error('deletePayment error:', err);
    if (err.name === 'CastError')
      return res.status(400).json({ message: 'Invalid payment ID format.' });
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/payments/send-pending-alerts ──────────────────────────────────
// Send WhatsApp fee-due alerts to all active students with outstanding fees.
// ⚠️ This route must be registered BEFORE /:id routes in paymentRoutes.js
exports.sendPendingAlerts = async (req, res) => {
  try {
    const today    = new Date();
    const students = await Student.find({ isActive: { $ne: false } }).lean();
    const payments = await Payment.find({ purpose: 'Monthly Fee' })
      .select('studentId amount')
      .lean();

    // Pre-aggregate total paid per student — O(M) instead of O(N×M)
    const paidByStudent = new Map();
    for (const p of payments) {
      const sid = p.studentId?.toString();
      if (sid) paidByStudent.set(sid, (paidByStudent.get(sid) || 0) + (p.amount || 0));
    }

    const results = [];

    for (const student of students) {
      const joinDate = new Date(student.createdAt || student.joinDate);
      let totalCycles =
        (today.getFullYear() - joinDate.getFullYear()) * 12 +
        (today.getMonth()    - joinDate.getMonth()) + 1;

      if (today.getDate() < joinDate.getDate()) totalCycles--;
      if (totalCycles <= 0) continue;   // Joined this month — no dues yet

      const fee          = getMonthlyFee(student.classType);
      const totalPaid    = paidByStudent.get(student._id.toString()) || 0;
      const totalDue     = Math.max(0, totalCycles * fee - totalPaid);
      if (totalDue <= 0) continue;

      const pendingMonths = Math.ceil(totalDue / fee);
      const whatsappNum   = student.whatsappNumber || student.phone;

      let alertResult = { success: false, reason: 'no_number' };
      if (whatsappNum) {
        try {
          alertResult = await whatsapp.sendPendingFeesAlert(
            student._id,
            whatsappNum,
            student.studentName,
            pendingMonths,
            totalDue
          );
          if (alertResult.success) {
            await Student.updateOne({ _id: student._id }, { lastAlertSent: today });
          }
        } catch (e) {
          alertResult = { success: false, reason: e.message };
        }
      }

      results.push({
        studentId:    student._id,
        studentName:  student.studentName,
        phone:        student.phone,
        pendingMonths,
        totalDue,
        alertSent:    alertResult.success,
        alertReason:  alertResult.reason || null
      });
    }

    const sent   = results.filter((r) => r.alertSent).length;
    const failed = results.length - sent;

    res.json({
      success: true,
      message: `Alerts processed for ${results.length} student(s). Sent: ${sent}, Failed/Unconfigured: ${failed}.`,
      results
    });
  } catch (err) {
    console.error('sendPendingAlerts error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
