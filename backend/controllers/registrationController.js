const Registration = require('../models/Registration');
const Student      = require('../models/Student');
const whatsapp     = require('../services/whatsappService');

// ─── Category helper (Kids: age 1-9, Adults: age 10+, Fitness always Adults) ───
const computeCategory = (age, classType) => {
  if (classType === 'Fitness Class') return 'Adults';
  const n = parseInt(age);
  if (!age || isNaN(n)) return 'Adults';
  return n <= 9 ? 'Kids' : 'Adults';
};

// ─── POST /api/register  (public registration form) ─────────────────────────
exports.createPendingRegistration = async (req, res) => {
  try {
    const { studentName, phone } = req.body;

    // Explicit validation for best error messages
    if (!studentName?.trim())
      return res.status(400).json({ success: false, message: 'Student name is required.', field: 'studentName' });
    if (!phone?.trim())
      return res.status(400).json({ success: false, message: 'Phone number is required.', field: 'phone' });

    // Reject if a pending registration already exists for this exact phone AND name
    const pendingDuplicate = await Registration.findOne({ 
      phone: phone.trim(), 
      studentName: studentName.trim(),
      status: 'pending' 
    });
    if (pendingDuplicate)
      return res.status(409).json({
        success: false,
        message: 'A registration with this name and phone number is already pending approval.',
        field: 'phone'
      });

    // Strip frontend-only fields before saving
    const cleanData = { ...req.body };
    delete cleanData.whatsappSame;

    const registration = new Registration(cleanData);
    await registration.save();

    // NOTE: WhatsApp welcome is sent ONLY when admin approves the registration, not on submission.

    // Notify admin dashboard in real-time (triggers dashboard refresh + badge bump)
    const io = req.app.get('socketio');
    if (io) {
      io.emit('dataChanged', { type: 'registration', name: registration.studentName });
    }

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully! Please wait for admin approval.',
      data: { id: registration._id, studentName: registration.studentName }
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      console.warn('⚠️ createPendingRegistration validation failed:', err.message);
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. '), errors: messages });
    }
    console.error('createPendingRegistration error:', err);
    if (err.code === 11000)
      return res.status(409).json({ success: false, message: 'This registration already exists.' });
    res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
};

// ─── GET /api/registrations  (all registrations, filterable by status) ────────
exports.getAllRegistrations = async (req, res) => {
  try {
    const query = req.query.status ? { status: req.query.status } : {};
    const registrations = await Registration.find(query).sort({ createdAt: -1 }).lean();
    res.json(registrations);
  } catch (err) {
    console.error('getAllRegistrations error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch registrations.' });
  }
};

// ─── GET /api/registrations/pending ─────────────────────────────────────────
exports.getPendingRegistrations = async (req, res) => {
  try {
    const registrations = await Registration.find({ status: 'pending' }).sort({ createdAt: -1 }).lean();
    res.json(registrations);
  } catch (err) {
    console.error('getPendingRegistrations error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/registrations/:id/approve ─────────────────────────────────────
exports.approveRegistration = async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id);
    if (!registration) return res.status(404).json({ message: 'Registration not found.' });

    // Guard against duplicate students: only reject if both name and phone match
    const existing = await Student.findOne({ 
      phone: registration.phone, 
      studentName: registration.studentName 
    });
    if (existing) {
      registration.status = 'approved';
      await registration.save();
      return res.status(409).json({ message: 'A student with this name and phone number already exists.' });
    }

    // Promote registration → Student document
    const student = new Student({
      studentName:    registration.studentName,
      studentAge:     registration.studentAge,
      studentCategory: computeCategory(registration.studentAge, registration.classType),
      gender:         registration.gender,
      bloodGroup:     registration.bloodGroup,
      classType:      registration.classType,
      danceStyle:     registration.danceStyle,
      danceForFitness: registration.danceForFitness,
      whatsappNumber: registration.whatsappNumber,
      parentName:     registration.parentName,
      emergencyContactName: registration.emergencyContactName,
      emergencyContactPhone: registration.emergencyContactPhone,
      location:       registration.location,
      address:        registration.address,
      batchTiming:    registration.batchTiming,
      email:          registration.email,
      phone:          registration.phone,
      notes:          registration.notes,
      createdAt:      registration.createdAt
    });
    await student.save();

    registration.status = 'approved';
    await registration.save();

    // Send a WhatsApp utility message confirming approval (non-blocking)
    const whatsappNum = registration.whatsappNumber || registration.phone;
    if (whatsappNum) {
      whatsapp.sendWelcomeMessage(whatsappNum, registration.studentName, registration.classType, registration.batchTiming)
        .catch((e) => console.error('WhatsApp approval error:', e));
    }

    const io = req.app.get('socketio');
    if (io) {
      io.emit('dataChanged', { type: 'student', action: 'create' });
      io.emit('registrationApproved', { id: registration._id, name: registration.studentName });
    }

    res.json({ message: 'Registration approved.', student });
  } catch (err) {
    if (err.name === 'CastError')
      return res.status(400).json({ message: 'Invalid registration ID format.' });
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join('. ') });
    }
    console.error('approveRegistration error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/registrations/:id/reject ──────────────────────────────────────
exports.rejectRegistration = async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id);
    if (!registration) return res.status(404).json({ message: 'Registration not found.' });

    registration.status = 'rejected';
    await registration.save();

    res.json({ message: 'Registration rejected.' });
  } catch (err) {
    if (err.name === 'CastError')
      return res.status(400).json({ message: 'Invalid registration ID format.' });
    console.error('rejectRegistration error:', err);
    res.status(500).json({ message: err.message });
  }
};
