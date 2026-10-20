const Registration = require('../models/Registration');
const Student      = require('../models/Student');
const whatsapp     = require('../services/whatsappService');
const referral    = require('./referralController');
const { getClassEntries, getMonthlyFee, getBaseFee, getNetFee, parseDiscountInput, validateClasses, REFERRAL_PERCENT } = require('../utils/fees');

// ─── Category helper (Kids: age 1-9, Adults: age 10+, Fitness always Adults) ───
const computeCategory = (age, classType) => {
  if (classType === 'Fitness Class') return 'Adults';
  const n = parseInt(age);
  if (!age || isNaN(n)) return 'Adults';
  return n <= 9 ? 'Kids' : 'Adults';
};

// Plain-language messages for each form field, so the visitor can see exactly what to fix
const FRIENDLY = {
  studentName: 'Please enter the student’s full name (at least 2 letters).',
  phone: 'Please enter a valid phone number with at least 10 digits, for example 98765 43210.',
  whatsappNumber: 'Please enter a valid WhatsApp number, or leave it empty.',
  email: 'Please enter a valid email address, or leave it empty.',
  studentAge: 'Please enter the age as a number between 1 and 99.',
  classType: 'Please choose a class.',
  feePlan: 'Please choose the Zumba plan: 5 or 3 classes a week.',
  classSchedule: 'Please choose Weekday or Weekend.'
};
const fieldErrorsFrom = (err) => {
  const fieldErrors = {};
  for (const [path, e] of Object.entries(err.errors || {})) {
    const field = path.startsWith('extraClasses') ? 'classType' : path;
    fieldErrors[field] = FRIENDLY[field] || e.message;
  }
  return fieldErrors;
};

// Adds the fee breakdown the admin needs when deciding on an offer
const withFees = (reg) => {
  const category = computeCategory(reg.studentAge, reg.classType);
  const forFees = { ...reg, studentCategory: category };
  return {
    ...reg,
    studentCategory: category,
    classBreakdown: getClassEntries(forFees).map(e => ({
      classType: e.classType, feePlan: e.feePlan || '', batchTiming: e.batchTiming || '',
      fee: getMonthlyFee(e.classType, category, e.feePlan)
    })),
    baseFee: getBaseFee(forFees)
  };
};

// Adds "referred by" details so the admin can see it before accepting
const attachReferrals = async (list) => {
  const withCode = list.filter(r => r.referralCode);
  if (!withCode.length) return list;
  const codes = [...new Set(withCode.map(r => r.referralCode))];
  const ids = [...new Set(withCode.map(r => r.referrerStudentId).filter(Boolean).map(String))];
  const owners = await Student.find({ $or: [{ referralCode: { $in: codes } }, { 'referralCodeHistory.code': { $in: codes } }, { _id: { $in: ids } }] })
    .select('studentName isActive referralCode referralCodeHistory').lean();
  const byId = new Map(owners.map(s => [String(s._id), s]));
  const byCode = new Map();
  for (const s of owners) {
    if (s.referralCode) byCode.set(s.referralCode, s);
    for (const h of (s.referralCodeHistory || [])) byCode.set(h.code, s);
  }
  return list.map(r => {
    if (!r.referralCode) return r;
    const s = (r.referrerStudentId && byId.get(String(r.referrerStudentId))) || byCode.get(r.referralCode);
    const expired = !!s && s.referralCode !== r.referralCode;       // the owner has since made a new code
    return {
      ...r,
      referral: {
        code: r.referralCode,
        referrerName: s ? s.studentName : null,
        valid: !!s && s.isActive !== false,                          // a reward will be given when accepted
        codeExpired: expired,                                        // replaced after the friend used it — still honoured
        problem: !s ? 'The code owner no longer exists' : s.isActive === false ? 'The code owner is inactive' : '',
        percent: REFERRAL_PERCENT
      }
    };
  });
};

// ─── POST /api/register  (public registration form) ─────────────────────────
exports.createPendingRegistration = async (req, res) => {
  try {
    const { studentName, phone } = req.body;

    // Explicit validation for best error messages
    if (!studentName?.trim())
      return res.status(400).json({ success: false, message: FRIENDLY.studentName, field: 'studentName', fieldErrors: { studentName: FRIENDLY.studentName } });
    if (!phone?.trim())
      return res.status(400).json({ success: false, message: 'Please enter a phone number so we can contact you.', field: 'phone', fieldErrors: { phone: 'Please enter a phone number so we can contact you.' } });

    // Reject if a pending registration already exists for this exact phone AND name
    const pendingDuplicate = await Registration.findOne({ 
      phone: phone.trim(), 
      studentName: studentName.trim(),
      status: 'pending' 
    });
    if (pendingDuplicate)
      return res.status(409).json({
        success: false,
        reason: 'already_pending',
        message: 'You have already registered with this name and phone number. We have your request and will contact you soon — there is no need to register again.',
        field: 'phone'
      });

    // Strip frontend-only fields before saving
    const cleanData = { ...req.body };
    delete cleanData.whatsappSame;

    // Only keep the fields we expect for each extra class; ignore anything else
    cleanData.extraClasses = Array.isArray(cleanData.extraClasses)
      ? cleanData.extraClasses.map(e => ({ classType: e?.classType, feePlan: e?.feePlan || '', batchTiming: e?.batchTiming || '' }))
      : [];

    // Optional referral code: must belong to an active student, can't be your own, and only for new students
    const ref = await referral.validateForRegistration({
      code: cleanData.referralCode, phone: cleanData.phone, whatsappNumber: cleanData.whatsappNumber, studentName: cleanData.studentName
    });
    if (ref.error)
      return res.status(400).json({ success: false, message: ref.error, field: 'referralCode', fieldErrors: { referralCode: ref.error }, reason: ref.reason, title: ref.title, steps: ref.steps });
    if (ref.code) { cleanData.referralCode = ref.code; cleanData.referrerStudentId = ref.referrer._id; } else delete cleanData.referralCode;

    // A form can only ever create a PENDING registration: these are decided by the server / the admin
    for (const field of ['_id', 'status', 'createdAt', 'referralResult', 'referralNote']) delete cleanData[field];
    if (!ref.code) delete cleanData.referrerStudentId;   // never taken from the form

    // Zumba needs a weekly plan (5 or 3 classes) — mandatory, also for extra classes
    const classError = validateClasses(cleanData.classType, cleanData.feePlan, cleanData.extraClasses);
    if (classError)
      return res.status(400).json({ success: false, message: classError, field: 'classType', fieldErrors: { classType: classError } });

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
      const fieldErrors = fieldErrorsFrom(err);
      const messages = Object.values(fieldErrors);
      return res.status(400).json({ success: false, message: messages[0], errors: messages, fieldErrors, field: Object.keys(fieldErrors)[0] });
    }
    console.error('createPendingRegistration error:', err);
    if (err.code === 11000)
      return res.status(409).json({ success: false, reason: 'already_pending', message: 'This registration already exists. We have your request and will contact you soon.' });
    res.status(500).json({ success: false, message: 'Something went wrong on our side. Please try again in a moment, or call the studio.' });
  }
};

// ─── GET /api/registrations  (all registrations, filterable by status) ────────
exports.getAllRegistrations = async (req, res) => {
  try {
    const query = req.query.status ? { status: req.query.status } : {};
    const registrations = await Registration.find(query).sort({ createdAt: -1 }).lean();
    res.json(await attachReferrals(registrations.map(withFees)));
  } catch (err) {
    console.error('getAllRegistrations error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch registrations.' });
  }
};

// ─── GET /api/registrations/pending ─────────────────────────────────────────
exports.getPendingRegistrations = async (req, res) => {
  try {
    const registrations = await Registration.find({ status: 'pending' }).sort({ createdAt: -1 }).lean();
    res.json(await attachReferrals(registrations.map(withFees)));
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

    // Optional offer decided by the admin when accepting: % off and/or flat ₹ off the monthly fee
    const discount = parseDiscountInput(req.body);
    if (discount.error) return res.status(400).json({ message: discount.error });

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
      classSchedule:  registration.classSchedule || 'NA',
      danceStyle:     registration.danceStyle,
      danceForFitness: registration.danceForFitness,
      feePlan:        registration.feePlan,
      extraClasses:   (registration.extraClasses || []).map(e => ({ classType: e.classType, feePlan: e.feePlan, batchTiming: e.batchTiming })),
      discounts:      (discount.percent > 0 || discount.amount > 0)
        ? [{ fromCycle: 0, percent: discount.percent, amount: discount.amount }]
        : [],
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

    // Referral: the person who gave the code earns a discount now that this student is accepted
    let referralOutcome = null;
    if (registration.referralCode) {
      try {
        referralOutcome = await referral.grantReward(registration, student);
        if (referralOutcome) {
          registration.referralResult = referralOutcome.result;
          registration.referralNote = referralOutcome.note;
        }
      } catch (refErr) {
        console.error('Referral reward error (student was still accepted):', refErr);
        referralOutcome = { result: 'skipped', note: 'The referral reward could not be applied.' };
      }
    }

    registration.status = 'approved';
    await registration.save();

    // Send WhatsApp welcome message on approval (non-blocking)
    const whatsappNum = registration.whatsappNumber || registration.phone;
    if (whatsappNum) {
      const classNames = [registration.classType, ...(registration.extraClasses || []).map(e => e.classType)].join(' + ');
      whatsapp.sendWelcomeMessage(whatsappNum, registration.studentName, classNames, registration.batchTiming)
        .catch((e) => console.error('WhatsApp approval error:', e));
    }

    const io = req.app.get('socketio');
    if (io) {
      io.emit('dataChanged', { type: 'student', action: 'create' });
      io.emit('registrationApproved', { id: registration._id, name: registration.studentName });
    }

    res.json({ message: 'Registration approved.', student, baseFee: getBaseFee(student), netFee: getNetFee(student), referral: referralOutcome });
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
