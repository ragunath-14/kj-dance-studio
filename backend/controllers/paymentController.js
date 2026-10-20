const Payment  = require('../models/Payment');
const Student  = require('../models/Student');
const whatsapp = require('../services/whatsappService');
const { studentSearchClauses } = require('../utils/search');
const { getNetFee, getBaseFee, getFeeForCycle, getExpectedTotal, getPendingMonths, getTotalCycles, getMonthlyBreakdown, getCycleMonth } = require('../utils/fees');

// ─── Month names helper ───────────────────────────────────────────────────────
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── GET /api/payments ───────────────────────────────────────────────────────
// Builds the Mongo query for the Paid tab from the request's filters (also used for the tab count)
const buildPaymentQuery = async (q) => {
  const search          = q.search          || '';
  const studentCategory = q.studentCategory || '';
  // Optional month/year filter (e.g. ?filterMonth=6&filterYear=2026)
  const filterMonth     = q.filterMonth !== undefined ? parseInt(q.filterMonth) : null;
  const filterYear      = q.filterYear  !== undefined ? parseInt(q.filterYear)  : null;

  // If searching by name or filtering by category, resolve matching student IDs first
  let studentIdFilter = null;
  if (search.trim() || studentCategory) {
    const studentQuery = {};
    if (search.trim())   studentQuery.$or = studentSearchClauses(search);
    if (studentCategory) studentQuery.studentCategory = studentCategory;
    const matchingStudents = await Student.find(studentQuery).select('_id').lean();
    studentIdFilter = matchingStudents.map(s => s._id);
  }

  const paymentQuery = studentIdFilter !== null ? { studentId: { $in: studentIdFilter } } : {};

  // Apply month/year filter if provided (for "this month paid" view)
  if (!Number.isNaN(filterMonth) && !Number.isNaN(filterYear) && filterMonth !== null && filterYear !== null) {
    paymentQuery.purpose  = 'Monthly Fee';
    paymentQuery.forMonth = filterMonth;
    paymentQuery.forYear  = filterYear;
  }
  return paymentQuery;
};

// ─── GET /api/payments (Paginated) ──────────────────────────────────────────
exports.getAllPayments = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip  = (page - 1) * limit;
    const paymentQuery = await buildPaymentQuery(req.query);

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
    const netFee   = getNetFee(student); // current monthly fee after any offer

    // Same rule as the Unpaid list: money received covers the OLDEST unpaid month first, so this
    // history always adds up to the same total as "billed - paid".
    const totalPaid = payments.filter(p => p.purpose === 'Monthly Fee').reduce((sum, p) => sum + (p.amount || 0), 0);
    const cyclesDue = Math.max(0, getTotalCycles(joinDate, today));
    const { rows, credit } = getMonthlyBreakdown(student, cyclesDue, totalPaid);

    const labelOf = (cycle) => { const { month, year } = getCycleMonth(joinDate, cycle); return { year, month, label: `${MONTH_NAMES[month]} ${year}` }; };
    const monthHistory = rows.map(r => ({ ...labelOf(r.cycle), fee: r.fee, paid: r.paid, due: r.due, status: r.status }));

    // Paid ahead: leftover money that fully covers the next month(s), up to the current calendar month
    const todayIdx = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth());
    let remaining = credit;
    for (let idx = cyclesDue; idx <= todayIdx; idx++) {
      const fee = getFeeForCycle(student, idx);
      if (fee <= 0 || remaining < fee) break;
      remaining -= fee;
      monthHistory.push({ ...labelOf(idx), fee, paid: fee, due: 0, status: 'paid' });
    }

    // Reverse so newest month is first
    monthHistory.reverse();

    res.json({ payments, monthHistory, student: { fee: netFee, baseFee: getBaseFee(student) } });
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
      // A month can take more than one payment (a part-payment now, the balance later) — it is only
      // refused once that month's fee has been paid in full.
      const sameMonth = await Payment.find({
        studentId,
        purpose: 'Monthly Fee',
        forMonth: paymentData.forMonth,
        forYear:  paymentData.forYear
      }).lean();
      if (sameMonth.length) {
        const joined = new Date(student.createdAt || student.joinDate);
        const cycle  = Math.max(0, (paymentData.forYear - joined.getFullYear()) * 12 + (paymentData.forMonth - joined.getMonth()));
        const monthFee = getFeeForCycle(student.toObject(), cycle);
        const alreadyPaid = sameMonth.reduce((sum, p) => sum + (p.amount || 0), 0);
        if (alreadyPaid >= monthFee) {
          return res.status(409).json({
            message: `${MONTH_NAMES[paymentData.forMonth]} ${paymentData.forYear} is already paid in full for this student (₹${alreadyPaid} of ₹${monthFee}).`
          });
        }
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
        .select('studentName phone whatsappNumber classType feePlan extraClasses discounts referralRewards studentCategory isActive createdAt lastAlertSent')
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

      const fee          = getNetFee(student);
      const totalPaid    = paidByStudent.get(student._id.toString()) || 0;
      const totalDue     = Math.max(0, getExpectedTotal(student, totalCycles) - totalPaid);
      if (totalDue <= 0) continue;

      const pendingMonths = getPendingMonths(student, totalCycles, totalPaid);
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

    const fee           = getNetFee(student);
    const totalDue      = Math.max(0, getExpectedTotal(student, totalCycles) - totalPaid);
    const pendingMonths = getPendingMonths(student, totalCycles, totalPaid);

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

// ─── GET /api/payments/counts?search=&studentCategory=&filterMonth=&filterYear= ───
// Numbers for the Paid / Unpaid tab buttons, independent of which tab is open:
//   unpaid = students who still owe money (same list as the Unpaid tab)
//   paid   = payment records the Paid tab shows for the chosen month (or all time)
// Both follow the search box and the Kids/Adults filter.
exports.getPaymentCounts = async (req, res) => {
  try {
    const { buildUnpaidList } = require('./studentController');
    const [unpaid, paymentQuery] = await Promise.all([
      buildUnpaidList({ search: req.query.search || '', studentCategory: req.query.studentCategory || '' }),
      buildPaymentQuery(req.query)
    ]);
    res.json({ unpaid: unpaid.length, paid: await Payment.countDocuments(paymentQuery) });
  } catch (err) {
    console.error('getPaymentCounts error:', err);
    res.status(500).json({ message: 'Could not count payments.' });
  }
};

// ─── POST /api/payments/clear-dues/:studentId ────────────────────────────────
// "Clear All": records the student's ENTIRE outstanding balance in one go, one payment per unpaid
// month (oldest first) so the month-by-month history shows each month settled. Body: { method?, date? }
exports.clearDues = async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    if (student.isActive === false) return res.status(400).json({ success: false, message: 'Student is inactive.' });

    const today    = new Date();
    const existing = await Payment.find({ studentId, purpose: 'Monthly Fee' }).lean();
    const totalPaid = existing.reduce((sum, p) => sum + (p.amount || 0), 0);
    const joinDate = new Date(student.createdAt || student.joinDate);
    const cycles   = getTotalCycles(joinDate, today);
    const plain    = student.toObject();
    const { rows } = getMonthlyBreakdown(plain, Math.max(0, cycles), totalPaid);
    const owing    = rows.filter(r => r.due > 0);

    if (!owing.length)
      return res.status(400).json({ success: false, message: 'This student has no outstanding dues.' });

    const date = req.body?.date ? new Date(req.body.date) : new Date();
    const docs = owing.map(r => {
      const { month, year } = getCycleMonth(joinDate, r.cycle);
      return { studentId, amount: r.due, method: req.body?.method || 'Cash', purpose: 'Monthly Fee', remainingFees: 0, date, forMonth: month, forYear: year };
    });
    const created = await Payment.insertMany(docs);
    const total   = docs.reduce((sum, d) => sum + d.amount, 0);

    // One confirmation message for the whole amount (not one per month)
    const whatsappNum = student.whatsappNumber || student.phone;
    if (whatsappNum) {
      whatsapp.sendPaymentConfirmation(whatsappNum, student.studentName, total, 'Monthly Fee', date.toLocaleDateString('en-IN'))
        .catch(err => console.error('Failed to send payment WhatsApp:', err.message));
    }
    await Student.updateOne({ _id: student._id }, { $unset: { lastAlertSent: '' } });

    const io = req.app.get('socketio');
    if (io) io.emit('dataChanged', { type: 'payment', action: 'create' });

    res.status(201).json({ success: true, totalCleared: total, months: created.length, payments: created });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid student ID format.' });
    console.error('clearDues error:', err);
    res.status(500).json({ success: false, message: 'Server error. Could not clear the dues.' });
  }
};
