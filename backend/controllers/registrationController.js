const Registration = require('../models/Registration');
const Student      = require('../models/Student');
const whatsapp     = require('../services/whatsappService');

// ─── POST /api/register  (public registration form) ─────────────────────────
exports.createPendingRegistration = async (req, res) => {
  try {
    const { studentName, phone } = req.body;

    // Explicit validation for best error messages
    if (!studentName?.trim())
      return res.status(400).json({ success: false, message: 'Student name is required.', field: 'studentName' });
    if (!phone?.trim())
      return res.status(400).json({ success: false, message: 'Phone number is required.', field: 'phone' });

    // Reject if a pending registration already exists for this phone number
    const pendingDuplicate = await Registration.findOne({ 
      phone: phone.trim(), 
      status: 'pending' 
    });
    if (pendingDuplicate)
      return res.status(409).json({
        success: false,
        message: 'A registration with this phone number is already pending approval.',
        field: 'phone'
      });

    // Strip frontend-only fields before saving
    const cleanData = { ...req.body };
    delete cleanData.whatsappSame;

    const registration = new Registration(cleanData);
    await registration.save();

    // Notify admin dashboard in real-time
    const io = req.app.get('socketio');
    if (io) io.emit('dataChanged', { type: 'registration', name: registration.studentName });

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully! Please wait for admin approval.',
      data: { id: registration._id, studentName: registration.studentName }
    });
  } catch (err) {
    console.error('createPendingRegistration error:', err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. '), errors: messages });
    }
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
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const [registrations, total] = await Promise.all([
      Registration.find({ status: 'pending' }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Registration.countDocuments({ status: 'pending' })
    ]);

    res.json({ data: registrations, total, page, limit, totalPages: Math.ceil(total / limit) });
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
      studentCategory: registration.studentCategory,
      studentAge:     registration.studentAge,
      gender:         registration.gender,
      classType:      registration.classType,
      danceStyle:     registration.danceStyle,
      danceForFitness: registration.danceForFitness,
      whatsappNumber: registration.whatsappNumber,
      parentName:     registration.parentName,
      emergencyContactName: registration.emergencyContactName,
      emergencyContactPhone: registration.emergencyContactPhone,
      location:       registration.location,
      address:        registration.address,
      email:          registration.email,
      phone:          registration.phone,
      notes:          registration.notes,
      createdAt:      registration.createdAt
    });
    await student.save();

    await Registration.findByIdAndDelete(req.params.id);

    // Send WhatsApp welcome message on approval (non-blocking)
    const phone = registration.whatsappNumber || registration.phone;
    console.log(`📲 [Approval] Sending welcome WhatsApp to ${phone} for ${registration.studentName}...`);
    whatsapp.sendWelcomeMessage(registration, registration.studentName, registration.classType)
      .then(r => {
        if (r.success) {
          console.log(`[Approval] Welcome message accepted by Meta for ${r.to || phone} (${registration.studentName}). ID: ${r.messageId || 'n/a'}`);
        } else {
          console.warn(`⚠️  [Approval] Welcome message failed for ${phone}: ${r.reason}`);
        }
      })
      .catch(e => console.error(`❌ [Approval] WhatsApp error for ${phone}:`, e.message));

    const io = req.app.get('socketio');
    if (io) {
      io.emit('dataChanged', { type: 'student', action: 'create' });
      io.emit('registrationApproved', { id: registration._id, name: registration.studentName });
    }

    res.json({ message: 'Registration approved.', student });
  } catch (err) {
    console.error('approveRegistration error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/registrations/:id/reject ──────────────────────────────────────
exports.rejectRegistration = async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id);
    if (!registration) return res.status(404).json({ message: 'Registration not found.' });

    await Registration.findByIdAndDelete(req.params.id);

    res.json({ message: 'Registration rejected.' });
  } catch (err) {
    console.error('rejectRegistration error:', err);
    res.status(500).json({ message: err.message });
  }
};

