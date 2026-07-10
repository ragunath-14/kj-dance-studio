const Payment  = require('../models/Payment');
const Student  = require('../models/Student');
const whatsapp = require('../services/whatsappService');

// ─── Fee helper ──────────────────────────────────────────────────────────────
const getMonthlyFee = (classType, studentCategory) => {
  if (classType === 'Fitness Class') return 2000;
  if (classType === 'Online Class')  return studentCategory === 'Kids' ? 1600 : 2000;
  return studentCategory === 'Kids' ? 1000 : 1300;
};

// ─── Month names helper ───────────────────────────────────────────────────────
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── GET /api/payments ───────────────────────────────────────────────────────
// ─── GET /api/payments (Paginated) ──────────────────────────────────────────
exports.getAllPayments = async (req, res) => {
  try {
    const page            = parseInt(req.query.page)  || 1;
    const limit           = parseInt(req.query.limit) || 50;
    const skip            = (page - 1) * limit;
    const search          = req.query.search          || '';
    const studentCategory = req.query.studentCategory || '';
    // Optional month/year filter (e.g. ?filterMonth=6&filterYear=2026)
    const filterMonth     = req.query.filterMonth !== undefined ? parseInt(req.query.filterMonth) : null;
    const filterYear      = req.query.filterYear  !== undefined ? parseInt(req.query.filterYear)  : null;

    // If searching by name, resolve matching student IDs first
    let studentIdFilter = null;
    if (search || studentCategory) {
      const studentQuery = {};
      if (search)          studentQuery.$or = [{ studentName: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }];
      if (studentCategory) studentQuery.studentCategory = studentCategory;
      const matchingStudents = await Student.find(studentQuery).select('_id').lean();
      studentIdFilter = matchingStudents.map(s => s._id);
    }

    const paymentQuery = studentIdFilter !== null ? { studentId: { $in: studentIdFilter } } : {};

    // Apply month/year filter if provided (for "this month paid" view)
    if (filterMonth !== null && filterYear !== null) {
      paymentQuery.purpose  = 'Monthly Fee';
      paymentQuery.forMonth = filterMonth;
      paymentQuery.forYear  = filterYear;
    }

    const [payments, total] = await Promise.all([
      Payment.find(paymentQuery)
        .populate('studentId', 'studentName studentCategory classType')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(paymentQuery)
    ]);

    res.json({ data: payments, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('getAllPayments error:', err);
    res.status(500).json({ message: 'Failed to fetch payments.' });
  }
};

// ─── GET /api/payments/student/:studentId ────────────────────────────────────
// Returns full payment history + per-month breakdown for a student
exports.getStudentPayments = async (req, res) => {
  try {
    const { studentId } = req.params;

    const [student, payments] = await Promise.all([
      Student.findById(studentId).lean(),
      Payment.find({ studentId }).sort({ date: -1 }).lean()
    ]);

    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const today    = new Date();
    const joinDate = new Date(student.createdAt || student.joinDate);
    const fee      = getMonthlyFee(student.classType, student.studentCategory);

    // Build per-month status from join month up to current month
    const monthHistory = [];
    let yr  = joinDate.getFullYear();
    let mo  = joinDate.getMonth();
    const curYr = today.getFullYear();
    const curMo = today.getMonth();

    // Map payments by month key for O(1) lookups
    const payByMonth = {};
    for (const p of payments) {
      if (p.purpose === 'Monthly Fee' && p.forYear !== undefined && p.forMonth !== undefined) {
        const key = `${p.forYear}-${p.forMonth}`;
        payByMonth[key] = (payByMonth[key] || 0) + (p.amount || 0);
      }
    }

    while (yr < curYr || (yr === curYr && mo <= curMo)) {
      const key    = `${yr}-${mo}`;
      const paid   = payByMonth[key] || 0;
      let status;
      if (paid >= fee)             status = 'paid';
      else if (paid > 0)           status = 'partial';
      else                         status = 'pending';

      monthHistory.push({
        year: yr, month: mo, label: `${MONTH_NAMES[mo]} ${yr}`,
        fee, paid, due: Math.max(0, fee - paid), status
      });

      mo++;
      if (mo > 11) { mo = 0; yr++; }
    }

    // Reverse so newest month is first
    monthHistory.reverse();

    res.json({ payments, monthHistory, student: { fee } });
  } catch (err) {
    console.error('getStudentPayments error:', err);
    res.status(500).json({ message: 'Failed to fetch student payments.' });
  }
};

// ─── POST /api/payments ──────────────────────────────────────────────────────
exports.createPayment = async (req, res) => {
  try {
    const { studentId, amount, purpose } = req.body;

    if (!studentId)
      return res.status(400).json({ message: 'Student is required for payment.' });
    if (!amount || amount <= 0)
      return res.status(400).json({ message: 'A valid payment amount is required.' });

    const student = await Student.findById(studentId);
    if (!student)
      return res.status(404).json({ message: 'Student not found. Cannot record payment.' });

    // Auto-populate forMonth / forYear for Monthly Fee payments
    const paymentData = { ...req.body };
    if (purpose === 'Monthly Fee') {
      const payDate = new Date(req.body.date || Date.now());
      if (paymentData.forMonth === undefined || paymentData.forMonth === null) {
        paymentData.forMonth = payDate.getMonth();
      }
      if (paymentData.forYear === undefined || paymentData.forYear === null) {
        paymentData.forYear = payDate.getFullYear();
      }
    }

    // --- Prevent Duplicate Payments for same month ---
    if (purpose === 'Monthly Fee' && paymentData.forMonth !== undefined) {
      const existingThisMonth = await Payment.findOne({
        studentId,
        purpose: 'Monthly Fee',
        forMonth: paymentData.forMonth,
        forYear:  paymentData.forYear
      });
      if (existingThisMonth) {
        return res.status(409).json({
          message: `A Monthly Fee payment for ${MONTH_NAMES[paymentData.forMonth]} ${paymentData.forYear} already exists for this student. Edit the existing record instead.`
        });
      }
    } else {
      // For non-monthly-fee: prevent same-day duplicate
      const paymentDate = new Date(req.body.date || Date.now());
      const startOfDay  = new Date(paymentDate); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay    = new Date(paymentDate); endOfDay.setHours(23, 59, 59, 999);
      const duplicatePayment = await Payment.findOne({
        studentId, amount, purpose: req.body.purpose,
        date: { $gte: startOfDay, $lte: endOfDay }
      });
      if (duplicatePayment) {
        return res.status(409).json({
          message: 'Duplicate detected: A payment for this student with the same amount and purpose is already recorded for this date.'
        });
      }
    }

    const payment    = new Payment(paymentData);
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
    const today = new Date();
    const curMo = today.getMonth();
    const curYr = today.getFullYear();

    const [students, allMonthlyFeePayments] = await Promise.all([
      Student.find({ isActive: { $ne: false } })
        .select('studentName phone whatsappNumber classType studentCategory isActive createdAt lastAlertSent')
        .lean(),
      Payment.find({ purpose: 'Monthly Fee' })
        .select('studentId amount forMonth forYear')
        .lean()
    ]);

    // Pre-aggregate total paid per student (all time) for total-due calculation
    const paidByStudent = new Map();
    // Also track per-month paid amounts
    const paidByStudentMonth = new Map(); // key: `${studentId}-${yr}-${mo}`
    for (const p of allMonthlyFeePayments) {
      const sid = p.studentId?.toString();
      if (!sid) continue;
      paidByStudent.set(sid, (paidByStudent.get(sid) || 0) + (p.amount || 0));
      if (p.forYear !== undefined && p.forMonth !== undefined) {
        const mk = `${sid}-${p.forYear}-${p.forMonth}`;
        paidByStudentMonth.set(mk, (paidByStudentMonth.get(mk) || 0) + (p.amount || 0));
      }
    }

    const results = [];

    for (const student of students) {
      const joinDate = new Date(student.createdAt || student.joinDate);
      let totalCycles =
        (today.getFullYear() - joinDate.getFullYear()) * 12 +
        (today.getMonth()    - joinDate.getMonth()) + 1;

      if (today.getDate() < joinDate.getDate()) totalCycles--;
      if (totalCycles <= 0) continue;

      const fee          = getMonthlyFee(student.classType, student.studentCategory);
      const totalPaid    = paidByStudent.get(student._id.toString()) || 0;
      const totalDue     = Math.max(0, totalCycles * fee - totalPaid);
      if (totalDue <= 0) continue;

      const pendingMonths = Math.ceil(totalDue / fee);
      const whatsappNum   = student.whatsappNumber || student.phone;

      let alertResult = { success: false, reason: 'no_number' };
      if (whatsappNum) {
        try {
          alertResult = await whatsapp.sendPendingFeesAlert(
            student._id, whatsappNum, student.studentName, pendingMonths, totalDue
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

// ─── POST /api/payments/send-reminder/:studentId ─────────────────────────────
exports.sendStudentReminder = async (req, res) => {
  try {
    const { studentId } = req.params;
    const today   = new Date();

    const student = await Student.findById(studentId).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    if (student.isActive === false) return res.status(400).json({ success: false, message: 'Student is inactive.' });

    const payments = await Payment.find({ studentId, purpose: 'Monthly Fee' }).lean();
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const joinDate = new Date(student.createdAt || student.joinDate);
    let totalCycles =
      (today.getFullYear() - joinDate.getFullYear()) * 12 +
      (today.getMonth()    - joinDate.getMonth()) + 1;
    if (today.getDate() < joinDate.getDate()) totalCycles--;

    if (totalCycles <= 0) {
      return res.json({ success: false, message: 'No dues yet — student joined this month.' });
    }

    const fee           = getMonthlyFee(student.classType, student.studentCategory);
    const totalDue      = Math.max(0, totalCycles * fee - totalPaid);
    const pendingMonths = Math.ceil(totalDue / fee);

    if (totalDue <= 0) {
      return res.json({ success: false, message: 'Student has no outstanding dues.' });
    }

    const whatsappNum = student.whatsappNumber || student.phone;
    if (!whatsappNum) {
      return res.status(400).json({ success: false, message: 'No WhatsApp/phone number on file.' });
    }

    const result = await whatsapp.sendPendingFeesAlert(
      student._id, whatsappNum, student.studentName, pendingMonths, totalDue
    );

    if (result.success) {
      await Student.updateOne({ _id: student._id }, { lastAlertSent: today });
    }

    res.json({
      success: result.success,
      message: result.success
        ? `✅ Reminder sent to ${student.studentName} (${whatsappNum}).`
        : `⚠️ Could not send: ${result.reason}`,
      studentName: student.studentName,
      totalDue,
      pendingMonths
    });
  } catch (err) {
    console.error('sendStudentReminder error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
