const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const whatsapp = require('../services/whatsappService');

// ─── Fee helper ──────────────────────────────────────────────────────────────
const getMonthlyFee = (classType) => classType === 'Fitness Class' ? 2500 : 3500;

// ─── GET /api/payments ───────────────────────────────────────────────────────
exports.getAllPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const studentId = req.query.studentId;
    const skip = (page - 1) * limit;

    let pipeline = [];

    // Filter by studentId if provided (History view - individual records)
    if (studentId) {
      pipeline.push({
        $match: { studentId: new mongoose.Types.ObjectId(studentId) }
      });
      pipeline.push({
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'studentId'
        }
      }, { $unwind: '$studentId' });

      pipeline.push({ $sort: { date: -1 } });
      pipeline.push({
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            { $project: { studentId: 1, amount: 1, method: 1, purpose: 1, date: 1, remainingFees: 1 } }
          ],
          total: [{ $count: 'count' }]
        }
      });
    } else {
      // List view - Group by student
      pipeline.push({
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student'
        }
      }, { $unwind: '$student' });

      if (search) {
        pipeline.push({
          $match: {
            'student.studentName': { $regex: search, $options: 'i' }
          }
        });
      }

      pipeline.push({
        $group: {
          _id: '$studentId',
          studentId: { $first: '$student' },
          amount: { $sum: '$amount' },
          date: { $max: '$date' },
          method: { $first: '$method' },
          purpose: { $first: '$purpose' },
          isGrouped: { $sum: 1 },
          originalId: { $first: '$_id' } // Keep one ID for basic actions if needed
        }
      });

      pipeline.push({ $sort: { date: -1 } });
      pipeline.push({
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: '$originalId', // Use one payment ID as the main ID for the row
                studentId: 1,
                amount: 1,
                date: 1,
                method: 1,
                purpose: 1,
                isGrouped: 1,
                realStudentId: '$_id'
              }
            }
          ],
          total: [{ $count: 'count' }]
        }
      });
    }

    const [result] = await Payment.aggregate(pipeline);
    const total = result.total[0]?.count || 0;

    res.json({
      data: result.data,
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

    if (student.isActive === false) {
      return res.status(400).json({ 
        message: 'This student is currently Inactive. You must activate the student profile before recording a payment.' 
      });
    }

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

    const payment = new Payment(req.body);
    const newPayment = await payment.save();

    // Return with student name populated
    await newPayment.populate('studentId', 'studentName phone whatsappNumber');

    // Automated WhatsApp Receipt
    const formattedDate = new Date(newPayment.date || Date.now()).toLocaleDateString('en-GB').replace(/\//g, '.');
    whatsapp.sendPaymentReceipt(student, student.studentName, newPayment.amount, newPayment.purpose, formattedDate, newPayment.remainingFees)
      .catch(e => console.error('WhatsApp receipt error:', e));

    const io = req.app.get('socketio');
    if (io) io.emit('dataChanged', { type: 'payment', action: 'create' });

    res.status(201).json(newPayment);
  } catch (err) {
    console.error('createPayment error:', err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join('. ') });
    }
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
    console.error('updatePayment error:', err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join('. ') });
    }
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
