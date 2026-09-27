const CampRegistration = require('../models/CampRegistration');
const Student          = require('../models/Student');
const whatsapp         = require('../services/whatsappService');
const { isCampEnabled } = require('./settingsController');

const CLASS_TYPES     = ['Regular Class', 'Fitness Class', 'Online Class'];
const CLASS_SCHEDULES = ['Weekday', 'Weekend', 'NA'];

// ─── Category helper (Kids: age 1-9, Adults: age 10+, Fitness always Adults) ───
const computeCategory = (age, classType) => {
  if (classType === 'Fitness Class') return 'Adults';
  const n = parseInt(age);
  if (!age || isNaN(n)) return 'Adults';
  return n <= 9 ? 'Kids' : 'Adults';
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── POST /api/camp/register  (public — rate limited in index.js) ────────────
exports.createCampRegistration = async (req, res) => {
  try {
    if (!(await isCampEnabled()))
      return res.status(403).json({ success: false, message: 'Summer camp registration is currently closed.' });

    // Whitelist fields — never let the public form set status or conversion data
    const { studentName, studentAge, gender, phone, whatsappNumber } = req.body;

    if (!studentName?.trim())
      return res.status(400).json({ success: false, message: 'Student name is required.', field: 'studentName' });
    if (!phone?.trim())
      return res.status(400).json({ success: false, message: 'Phone number is required.', field: 'phone' });

    const duplicate = await CampRegistration.findOne({
      phone: phone.trim(),
      studentName: studentName.trim(),
      status: 'registered'
    });
    if (duplicate)
      return res.status(409).json({
        success: false,
        message: 'A camp registration with this name and phone number already exists.',
        field: 'phone'
      });

    const registration = await new CampRegistration({
      studentName,
      studentAge,
      studentCategory: computeCategory(studentAge),
      gender,
      phone,
      whatsappNumber
    }).save();

    const io = req.app.get('socketio');
    if (io) io.emit('dataChanged', { type: 'camp', name: registration.studentName });

    res.status(201).json({
      success: true,
      message: 'Camp registration submitted successfully!',
      data: { id: registration._id, studentName: registration.studentName }
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. '), errors: messages });
    }
    console.error('createCampRegistration error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
};

// ─── GET /api/camp?search=&studentCategory=&status=&page=&limit= ─────────────
// `counts` always covers the whole collection so the status tabs stay accurate
// while other filters are applied.
exports.getCampRegistrations = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 50;
    const { search = '', studentCategory = '', status = '' } = req.query;

    const query = {};
    if (search) {
      const re = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ studentName: re }, { phone: re }];
    }
    if (studentCategory) query.studentCategory = studentCategory;
    if (status)          query.status          = status;

    const [data, total, grouped] = await Promise.all([
      CampRegistration.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CampRegistration.countDocuments(query),
      CampRegistration.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])
    ]);

    const counts = { registered: 0, converted: 0 };
    grouped.forEach(g => { counts[g._id] = g.n; });
    counts.total = counts.registered + counts.converted;

    res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit), counts });
  } catch (err) {
    console.error('getCampRegistrations error:', err);
    res.status(500).json({ message: 'Failed to fetch camp registrations.' });
  }
};

// ─── POST /api/camp/:id/convert ──────────────────────────────────────────────
// Body: { classType, classSchedule }. Promotes the camp registration to a normal
// Student. The join date is "now", so monthly fees start from conversion — not
// from the (free) camp sign-up date.
exports.convertToStudent = async (req, res) => {
  try {
    const classType     = req.body.classType     || 'Regular Class';
    const classSchedule = req.body.classSchedule || 'NA';

    if (!CLASS_TYPES.includes(classType))
      return res.status(400).json({ message: `${classType} is not a valid class type.` });
    if (!CLASS_SCHEDULES.includes(classSchedule))
      return res.status(400).json({ message: `${classSchedule} is not a valid class schedule.` });

    const camp = await CampRegistration.findById(req.params.id);
    if (!camp) return res.status(404).json({ message: 'Camp registration not found.' });
    if (camp.status === 'converted')
      return res.status(400).json({ message: 'This registration has already been converted.' });

    const io = req.app.get('socketio');

    // Same duplicate rule as the new-joiner approval: name AND phone must match
    const existing = await Student.findOne({ phone: camp.phone, studentName: camp.studentName });
    if (existing) {
      camp.status             = 'converted';
      camp.convertedStudentId = existing._id;
      camp.convertedAt        = new Date();
      await camp.save();
      if (io) io.emit('dataChanged', { type: 'camp', action: 'convert' });
      return res.status(409).json({
        message: 'A student with this name and phone number already exists — camp registration marked as converted.'
      });
    }

    const student = await new Student({
      studentName:     camp.studentName,
      studentAge:      camp.studentAge,
      studentCategory: computeCategory(camp.studentAge, classType),
      gender:          camp.gender,
      phone:           camp.phone,
      whatsappNumber:  camp.whatsappNumber,
      classType,
      classSchedule
    }).save();

    camp.status             = 'converted';
    camp.convertedStudentId = student._id;
    camp.convertedAt        = new Date();
    await camp.save();

    // Same welcome message every other enrolment path sends (non-blocking)
    const whatsappNum = student.whatsappNumber || student.phone;
    if (whatsappNum) {
      whatsapp.sendWelcomeMessage(whatsappNum, student.studentName, student.classType, student.batchTiming)
        .catch((e) => console.error('WhatsApp welcome error (convertToStudent):', e));
    }

    if (io) {
      io.emit('dataChanged', { type: 'student', action: 'create' });
      io.emit('dataChanged', { type: 'camp', action: 'convert' });
    }

    res.json({ message: 'Converted to a regular student.', student });
  } catch (err) {
    if (err.name === 'CastError')
      return res.status(400).json({ message: 'Invalid registration ID format.' });
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join('. ') });
    }
    console.error('convertToStudent error:', err);
    res.status(500).json({ message: 'Server error. Could not convert registration.' });
  }
};

// ─── DELETE /api/camp/:id ────────────────────────────────────────────────────
// Removes the camp registration only — a converted Student is left untouched.
exports.deleteCampRegistration = async (req, res) => {
  try {
    const removed = await CampRegistration.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ message: 'Camp registration not found.' });

    const io = req.app.get('socketio');
    if (io) io.emit('dataChanged', { type: 'camp', action: 'delete' });

    res.json({ success: true, message: 'Camp registration deleted.' });
  } catch (err) {
    if (err.name === 'CastError')
      return res.status(400).json({ message: 'Invalid registration ID format.' });
    console.error('deleteCampRegistration error:', err);
    res.status(500).json({ message: 'Server error. Could not delete registration.' });
  }
};
