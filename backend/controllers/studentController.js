const Student  = require('../models/Student');
const Payment  = require('../models/Payment');
const whatsapp = require('../services/whatsappService');

// ─── Fee helper ──────────────────────────────────────────────────────────────
const getMonthlyFee = (classType, studentCategory) => {
  if (classType === 'Fitness Class') return 2000;
  return studentCategory === 'Kids' ? 1000 : 1300;
};

// ─── Format mongoose validation errors ───────────────────────────────────────
const formatValidationErrors = (err) =>
  Object.values(err.errors).map((e) => e.message);

// ─── GET /api/students ───────────────────────────────────────────────────────
// ─── GET /api/students (Paginated) ──────────────────────────────────────────
exports.getAllStudents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Default limit
    const skip = (page - 1) * limit;
    const search          = req.query.search          || '';
    const classType       = req.query.classType       || '';
    const studentCategory = req.query.studentCategory || '';

    let query = {};
    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { phone:       { $regex: search, $options: 'i' } }
      ];
    }
    if (classType)       query.classType       = classType;
    if (studentCategory) query.studentCategory = studentCategory;

    const [students, total] = await Promise.all([
      Student.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Student.countDocuments(query)
    ]);

    // Aggregate monthly fee payments for the returned subset of students
    const studentIds = students.map(s => s._id);
    const payments = await Payment.find({
      studentId: { $in: studentIds },
      purpose: 'Monthly Fee'
    }).lean();

    const paymentsByStudent = {};
    payments.forEach(p => {
      if (p.studentId) {
        const sid = p.studentId.toString();
        paymentsByStudent[sid] = (paymentsByStudent[sid] || 0) + (p.amount || 0);
      }
    });

    const studentsWithTotalPaid = students.map(s => ({
      ...s,
      totalPaid: paymentsByStudent[s._id.toString()] || 0
    }));

    res.json({
      data: studentsWithTotalPaid,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('getAllStudents error:', err);
    res.status(500).json({ message: 'Failed to fetch students.' });
  }
};

// ─── GET /api/students/dashboard/stats ───────────────────────────────────────
// Aggregates all data for the dashboard metrics in one fast call using O(M)
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd   = new Date(currentYear, currentMonth + 1, 1);
    const Registration = require('../models/Registration');

    // Parallel fetch — aggregate monthly-fee totals per student in one DB call
    const [students, monthlyFeePaidMap, monthRevenue, lifetimeRevenue, pendingRegistrations, recentRegistrations] = await Promise.all([
      Student.find().select('studentName phone whatsappNumber classType isActive createdAt lastAlertSent').lean(),
      // O(M) aggregation: total Monthly Fee paid per student (all time)
      Payment.aggregate([
        { $match: { purpose: 'Monthly Fee' } },
        { $group: { _id: '$studentId', totalPaid: { $sum: '$amount' } } }
      ]),
      // Current month revenue — match on date OR createdAt so legacy records are included
      Payment.aggregate([
        {
          $match: {
            $or: [
              { date: { $gte: monthStart, $lt: monthEnd } },
              { createdAt: { $gte: monthStart, $lt: monthEnd } }
            ]
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // Lifetime revenue
      Payment.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // Pending registrations for badge count
      Registration.find({ status: 'pending' }).lean(),
      // All registrations from last 24h for activity feed
      Registration.find({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
        .sort({ createdAt: -1 }).limit(10).lean()
    ]);

    // Build O(1) lookup for monthly fee totals
    const paidMap = new Map(monthlyFeePaidMap.map(r => [r._id.toString(), r.totalPaid]));

    const activeStudents = students.filter(s => s.isActive !== false);




    // Fetch recent activity (last 24 hours) — match on date OR createdAt
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentPayments = await Payment
      .find({
        $or: [
          { date: { $gte: since24h } },
          { createdAt: { $gte: since24h } }
        ]
      })
      .populate('studentId', 'studentName')
      .sort({ date: -1 })
      .limit(15)
      .lean();

    const recentActivity = [
      ...recentPayments.map(p => ({
        type: 'payment', date: p.date || p.createdAt,
        amount: p.amount, purpose: p.purpose, studentId: p.studentId
      })),
      ...recentRegistrations.map(r => ({
        type: 'reg', date: r.createdAt, studentName: r.studentName, classType: r.classType
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    // Build overdue detail list (used both for count and the overdue panel)
    const overdueStudents = activeStudents
      .map(student => {
        const joinDate = new Date(student.createdAt || student.joinDate);
        let totalCycles =
          (today.getFullYear() - joinDate.getFullYear()) * 12 +
          (today.getMonth()    - joinDate.getMonth()) + 1;
        if (today.getDate() < joinDate.getDate()) totalCycles--;
        if (totalCycles <= 0) return null;

        const fee       = getMonthlyFee(student.classType, student.studentCategory);
        const totalPaid = paidMap.get(student._id.toString()) || 0;
        const totalDue  = Math.max(0, totalCycles * fee - totalPaid);
        if (totalDue <= 0) return null;

        const pendingMonths = Math.ceil(totalDue / fee);
        return {
          _id:           student._id,
          studentName:   student.studentName,
          phone:         student.phone,
          whatsappNumber:student.whatsappNumber,
          classType:     student.classType,
          totalDue,
          pendingMonths,
          lastAlertSent: student.lastAlertSent || null
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.totalDue - a.totalDue);

    res.json({
      metrics: {
        total:         activeStudents.length,
        totalStudents: students.length,
        totalPayments: monthlyFeePaidMap.length, // approximate — avoids extra DB round-trip
        revenue:       monthRevenue[0]?.total || 0,
        lifetime:      lifetimeRevenue[0]?.total || 0,
        overdue:       overdueStudents.length,
        pending:       pendingRegistrations.length,
        classTypes: {
          dance:   activeStudents.filter(s => s.classType === 'Dance Class').length,
          regular: activeStudents.filter(s => s.classType === 'Regular Class').length,
          fitness: activeStudents.filter(s => s.classType === 'Fitness Class').length,
          online:  activeStudents.filter(s => s.classType === 'Online Class').length,
        }
      },
      overdueStudents,
      recentActivity,
      registrations: pendingRegistrations
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    res.status(500).json({ message: 'Failed to fetch dashboard stats.' });
  }
};

// ─── GET /api/students/unpaid (Paginated) ───────────────────────────────────
exports.getUnpaidStudents = async (req, res) => {
  try {
    const today           = new Date();
    const search          = req.query.search          || '';
    const studentCategory = req.query.studentCategory || '';

    const dbQuery = { isActive: { $ne: false } };
    if (studentCategory) dbQuery.studentCategory = studentCategory;

    const [students, monthlyFeePaidMap] = await Promise.all([
      Student.find(dbQuery)
        .select('studentName phone whatsappNumber classType studentCategory isActive createdAt lastAlertSent')
        .lean(),
      Payment.aggregate([
        { $match: { purpose: 'Monthly Fee' } },
        { $group: { _id: '$studentId', totalPaid: { $sum: '$amount' } } }
      ])
    ]);

    const paymentsByStudent = new Map(monthlyFeePaidMap.map(r => [r._id.toString(), r.totalPaid]));

    let unpaid = students.map(student => {
      const joinDate = new Date(student.createdAt || student.joinDate);
      let totalCycles = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth()) + 1;
      if (today.getDate() < joinDate.getDate()) totalCycles--;
      if (totalCycles <= 0) return null;

      const fee           = getMonthlyFee(student.classType, student.studentCategory);
      const totalPaid     = paymentsByStudent.get(student._id.toString()) || 0;
      const totalDue      = Math.max(0, (totalCycles * fee) - totalPaid);
      const pendingMonths = Math.ceil(totalDue / fee);
      if (pendingMonths <= 0) return null;

      return { ...student, totalDue, pendingMonths };
    })
    .filter(Boolean)
    .sort((a, b) => b.totalDue - a.totalDue);

    if (search) {
      const re = new RegExp(search, 'i');
      unpaid = unpaid.filter(s => re.test(s.studentName) || re.test(s.phone));
    }

    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip  = (page - 1) * limit;

    res.json({
      data      : unpaid.slice(skip, skip + limit),
      total     : unpaid.length,
      page,
      limit,
      totalPages: Math.ceil(unpaid.length / limit)
    });
  } catch (err) {
    console.error('getUnpaidStudents error:', err);
    res.status(500).json({ message: 'Failed to fetch unpaid students.' });
  }
};

// ─── GET /api/students/:id/public-dues ───────────────────────────────────────
// Returns the current due amount for a student (used for public checks/reminders)
exports.getStudentDues = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const today = new Date();
    const joinDate = new Date(student.createdAt || student.joinDate);
    
    let totalCycles = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth()) + 1;
    if (today.getDate() < joinDate.getDate()) totalCycles--;
    
    if (totalCycles <= 0) {
      return res.json({ totalDue: 0, pendingMonths: 0, totalPaid: 0 });
    }

    const payments = await Payment.find({ 
      studentId: student._id, 
      purpose: 'Monthly Fee' 
    }).lean();

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const fee = getMonthlyFee(student.classType);
    const totalDue = Math.max(0, (totalCycles * fee) - totalPaid);
    const pendingMonths = Math.ceil(totalDue / fee);

    res.json({
      studentName: student.studentName,
      totalDue,
      pendingMonths,
      totalPaid,
      fee
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid student ID format.' });
    }
    console.error('getStudentDues error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── POST /api/students ──────────────────────────────────────────────────────
exports.createStudent = async (req, res) => {
  try {
    const data = { ...req.body };

    // Field-name compatibility shims
    if (!data.studentName && data.name)     data.studentName = data.name;
    if (!data.createdAt   && data.joinDate) data.createdAt   = data.joinDate;

    // Explicit required-field check (better error messages than Mongoose default)
    if (!data.studentName?.trim())
      return res.status(400).json({ message: 'Student name is required.' });
    if (!data.phone?.trim())
      return res.status(400).json({ message: 'Phone number is required.' });

    // Duplicate guard: Only reject if BOTH phone and name match
    const existing = await Student.findOne({ 
      phone: data.phone.trim(), 
      studentName: data.studentName.trim() 
    });
    if (existing)
      return res.status(409).json({ message: 'A student with this exact name and phone number is already registered.' });

    const student    = new Student(data);
    const newStudent = await student.save();

    const io = req.app.get('socketio');
    if (io) io.emit('dataChanged', { type: 'student', action: 'create' });

    // Send WhatsApp welcome message (non-blocking, same as registration approval)
    const whatsappNum = newStudent.whatsappNumber || newStudent.phone;
    if (whatsappNum) {
      whatsapp.sendWelcomeMessage(
        whatsappNum,
        newStudent.studentName,
        newStudent.classType,
        newStudent.batchTiming
      ).catch((e) => console.error('WhatsApp welcome error (createStudent):', e));
    }

    res.status(201).json(newStudent);
  } catch (err) {
    if (err.name === 'ValidationError') {
      console.warn('⚠️ createStudent validation failed:', err.message);
      return res.status(400).json({ message: formatValidationErrors(err).join('. ') });
    }
    console.error('createStudent error:', err);
    if (err.code === 11000)
      return res.status(409).json({ message: 'A student with this information already exists.' });
    res.status(500).json({ message: 'Server error. Could not add student.' });
  }
};


// ─── PUT /api/students/:id ───────────────────────────────────────────────────
exports.updateStudent = async (req, res) => {
  try {
    const { id } = req.params;

    // Duplicate guard: Only reject if BOTH phone and name match for a different ID
    if (req.body.phone || req.body.studentName) {
      const query = { _id: { $ne: id } };
      
      // If updating phone, check with current name (or new name if provided)
      // If updating name, check with current phone (or new phone if provided)
      const currentStudent = await Student.findById(id);
      if (!currentStudent) return res.status(404).json({ message: 'Student not found.' });

      query.phone = (req.body.phone || currentStudent.phone).trim();
      query.studentName = (req.body.studentName || currentStudent.studentName).trim();

      const dup = await Student.findOne(query);
      if (dup)
        return res.status(409).json({ message: 'Another student with this exact name and phone number already exists.' });
    }

    const updated = await Student.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });
    if (!updated) return res.status(404).json({ message: 'Student not found.' });
    const io = req.app.get('socketio');
    if (io) io.emit('dataChanged', { type: 'student', action: 'update' });

    res.json(updated);
  } catch (err) {
    if (err.name === 'ValidationError') {
      console.warn('⚠️ updateStudent validation failed:', err.message);
      return res.status(400).json({ message: formatValidationErrors(err).join('. ') });
    }
    console.error('updateStudent error:', err);
    if (err.name === 'CastError')
      return res.status(400).json({ message: 'Invalid student ID format.' });
    res.status(500).json({ message: 'Server error. Could not update student.' });
  }
};

// ─── PATCH /api/students/:id/toggle-status ───────────────────────────────────
exports.toggleStatus = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const wasInactive = !student.isActive;
    student.isActive = !student.isActive;

    // When reactivating (Inactive -> Active), reset joining date to today
    if (student.isActive && wasInactive) {
      student.createdAt = new Date();
      student.markModified('createdAt'); // Explicitly tell Mongoose this field changed
    }

    await student.save();

    const io = req.app.get('socketio');
    if (io) io.emit('dataChanged', { type: 'student', action: 'statusToggle' });

    // Send rejoin WhatsApp whenever admin toggles active ↔ inactive
    const whatsappNum = student.whatsappNumber || student.phone;
    if (whatsappNum) {
      whatsapp.sendRejoinMessage(whatsappNum, student.studentName, student.classType)
        .catch((e) => console.error('WhatsApp rejoin message error (toggleStatus):', e));
    }

    res.json({
      message: `Student marked as ${student.isActive ? 'Active' : 'Inactive'}. ${student.isActive ? 'Join date reset to today.' : ''}`,
      student
    });
  } catch (err) {
    console.error('toggleStatus error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── DELETE /api/students/:id ────────────────────────────────────────────────
exports.deleteStudent = async (req, res) => {
  try {
    const studentId = req.params.id;
    const student = await Student.findByIdAndDelete(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    // Cascade delete related payments
    await Payment.deleteMany({ studentId: studentId });

    const io = req.app.get('socketio');
    if (io) {
      io.emit('dataChanged', { type: 'student', action: 'delete' });
      io.emit('dataChanged', { type: 'payment', action: 'delete' }); // Notify that payments might have changed
    }

    res.json({ success: true, message: 'Student and related details deleted successfully.' });
  } catch (err) {
    console.error('deleteStudent error:', err);
    if (err.name === 'CastError')
      return res.status(400).json({ message: 'Invalid student ID format.' });
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/students/activity (Paginated activity log) ─────────────────────
exports.getActivityLog = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip  = (page - 1) * limit;
    const Registration = require('../models/Registration');
    const fetchN = skip + limit;

    const [pays, regs, totalPays, totalRegs] = await Promise.all([
      Payment.find()
        .populate('studentId', 'studentName')
        .sort({ createdAt: -1 })
        .limit(fetchN)
        .lean(),
      Registration.find()
        .sort({ createdAt: -1 })
        .limit(fetchN)
        .lean(),
      Payment.countDocuments(),
      Registration.countDocuments()
    ]);

    const allItems = [
      ...pays.map(p => ({
        type       : 'payment',
        date       : p.createdAt,
        amount     : p.amount,
        purpose    : p.purpose,
        studentName: p.studentId?.studentName || 'Unknown Student',
        id         : p._id
      })),
      ...regs.map(r => ({
        type       : 'reg',
        date       : r.createdAt,
        studentName: r.studentName,
        classType  : r.classType,
        id         : r._id
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      data      : allItems.slice(skip, skip + limit),
      total     : totalPays + totalRegs,
      page,
      limit,
      totalPages: Math.ceil((totalPays + totalRegs) / limit)
    });
  } catch (err) {
    console.error('getActivityLog error:', err);
    res.status(500).json({ message: 'Failed to fetch activity log.' });
  }
};

