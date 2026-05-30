const Student  = require('../models/Student');
const Payment  = require('../models/Payment');
const MonthlyStat = require('../models/MonthlyStat');
const whatsapp = require('../services/whatsappService');

// ─── Fee helper ──────────────────────────────────────────────────────────────
const getMonthlyFee = (classType) => classType === 'Fitness Class' ? 2500 : 3500;

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
    const search = req.query.search || '';
    const classType = req.query.classType || '';

    let query = {};
    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { studentName: searchRegex },
        { phone: searchRegex }
      ];
    }
    if (classType) {
      query.classType = classType;
    }

    const [students, total] = await Promise.all([
      Student.aggregate([
        { $match: query },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'payments',
            localField: '_id',
            foreignField: 'studentId',
            as: 'payments'
          }
        },
        {
          $addFields: {
            totalPaid: {
              $reduce: {
                input: '$payments',
                initialValue: 0,
                in: {
                  $cond: [
                    { 
                      $and: [
                        { $eq: ['$$this.purpose', 'Monthly Fee'] },
                        // Compare dates by normalizing joining date to start of day
                        { $gte: ['$$this.date', { 
                          $dateFromParts: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' },
                            day: { $dayOfMonth: '$createdAt' }
                          }
                        }] }
                      ]
                    },
                    { $add: ['$$value', '$$this.amount'] },
                    '$$value'
                  ]
                }
              }
            }
          }
        },
        { $project: { payments: 0 } }
      ]),
      Student.countDocuments(query)
    ]);

    res.json({
      data: students,
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
// Aggregates all data for the dashboard metrics in one fast call
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth, 1);

    const [metrics, recentActivity] = await Promise.all([
      // Aggregated Metrics
      Student.aggregate([
        {
          $facet: {
            counts: [
              { $group: { _id: null, total: { $sum: 1 } } }
            ],
            classTypes: [
              { $match: { isActive: { $ne: false } } },
              { $group: { 
                _id: { $ifNull: ['$classType', 'Regular Class'] }, 
                count: { $sum: 1 } 
              } }
            ],
            overdue: [
              { $match: { isActive: { $ne: false } } },
              {
                $lookup: {
                  from: 'payments',
                  localField: '_id',
                  foreignField: 'studentId',
                  as: 'payments'
                }
              },
              {
                $addFields: {
                  totalPaid: {
                    $reduce: {
                      input: '$payments',
                      initialValue: 0,
                      in: {
                        $cond: [
                          { 
                            $and: [
                              { $eq: ['$$this.purpose', 'Monthly Fee'] },
                              { $gte: ['$$this.date', { 
                                $dateFromParts: {
                                  year: { $year: '$createdAt' },
                                  month: { $month: '$createdAt' },
                                  day: { $dayOfMonth: '$createdAt' }
                                }
                              }] }
                            ]
                          },
                          { $add: ['$$value', '$$this.amount'] },
                          '$$value'
                        ]
                      }
                    }
                  },
                  totalExpected: {
                    $let: {
                      vars: {
                        joinDate: '$createdAt',
                        cycles: {
                          $add: [
                            { $multiply: [{ $subtract: [currentYear, { $year: '$createdAt' }] }, 12] },
                            { $subtract: [currentMonth + 1, { $month: '$createdAt' }] },
                            1 // Add 1 to match frontend and getUnpaidStudents logic
                          ]
                        }
                      },
                      in: { $multiply: ['$$cycles', { $cond: [{ $eq: [{ $ifNull: ['$classType', 'Regular Class'] }, 'Fitness Class'] }, 2500, 3500] }] }
                    }
                  }
                }
              },
              { $match: { $expr: { $gt: ['$totalExpected', '$totalPaid'] } } },
              { $count: 'count' }
            ]
          }
        }
      ]),

      // Recent Activity (Last 24h)
      Promise.all([
        Payment.find({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
          .populate('studentId', 'studentName')
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        require('../models/Registration').find({ 
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean()
      ]).then(([pays, regs]) => [
        ...pays.map(p => ({ type: 'payment', date: p.createdAt, amount: p.amount, purpose: p.purpose, studentName: p.studentId?.studentName })),
        ...regs.map(r => ({ type: 'reg', date: r.createdAt, studentName: r.studentName, classType: r.classType }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date)))
    ]);

    // Revenue calculations
    const [revStats, pendingCount] = await Promise.all([
      Payment.aggregate([
        {
          $facet: {
            monthly: [
              { $match: { date: { $gte: startOfMonth } } },
              { $group: { _id: null, total: { $sum: '$amount' } } }
            ],
            history: [
              { 
                $group: { 
                  _id: { year: { $year: '$date' }, month: { $month: '$date' } },
                  total: { $sum: '$amount' }
                }
              },
              { $sort: { '_id.year': -1, '_id.month': -1 } },
              { $limit: 6 }
            ]
          }
        }
      ]),
      require('../models/Registration').countDocuments({ status: 'pending' })
    ]);

    const m = metrics[0];
    const classMap = {};
    m.classTypes.forEach(c => {
      if (c._id === 'Regular Class') classMap.regular = c.count;
      if (c._id === 'Summer Class') classMap.summer = c.count;
      if (c._id === 'Fitness Class') classMap.fitness = c.count;
    });

    const currentRevenue = revStats[0].monthly[0]?.total || 0;
    const currentTotalStudents = m.counts[0]?.total || 0;
    const currentOverdue = m.overdue[0]?.count || 0;

    // Persist snapshot for historical tracking
    const monthId = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    await MonthlyStat.findOneAndUpdate(
      { monthId },
      {
        year: currentYear,
        month: currentMonth + 1,
        revenue: currentRevenue,
        activeStudents: currentTotalStudents,
        newJoiners: pendingCount,
        overdueAmount: currentOverdue,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Format history for charting (e.g., "Jan", "Feb")
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const historyData = (revStats[0].history || []).map(h => ({
      name: `${monthNames[h._id.month - 1]} ${h._id.year.toString().slice(-2)}`,
      revenue: h.total
    })).reverse(); // Oldest first

    res.json({
      metrics: {
        total: currentTotalStudents,
        revenue: currentRevenue,
        overdue: currentOverdue,
        pending: pendingCount,
        classTypes: {
          regular: classMap.regular || 0,
          summer: classMap.summer || 0,
          fitness: classMap.fitness || 0,
        }
      },
      revenueHistory: historyData,
      recentActivity: recentActivity.slice(0, 10)
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    res.status(500).json({ message: 'Failed to fetch dashboard stats.' });
  }
};

exports.getUnpaidStudents = async (req, res) => {
  try {
    const today = new Date();
    const students = await Student.find({ isActive: { $ne: false } }).lean();
    const payments = await Payment.find({ purpose: 'Monthly Fee' }).lean();

    const paymentsByStudent = new Map();
    payments.forEach(p => {
      const sid = p.studentId?.toString();
      if (sid) paymentsByStudent.set(sid, (paymentsByStudent.get(sid) || 0) + (p.amount || 0));
    });

    const search = (req.query.search || '').trim().toLowerCase();
    const unpaid = students.map(student => {
      const joinDate = new Date(student.createdAt);
      
      // Calculate total paid ONLY after the joining/rejoining date
      const totalPaid = payments
        .filter(p => {
          const pDate = new Date(p.date);
          const jDate = new Date(joinDate);
          // Normalize to date-only for comparison on joining day
          const pDateOnly = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate());
          const jDateOnly = new Date(jDate.getFullYear(), jDate.getMonth(), jDate.getDate());
          
          return p.studentId?.toString() === student._id.toString() && 
                 p.purpose === 'Monthly Fee' &&
                 pDateOnly >= jDateOnly;
        })
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      let totalCycles = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth()) + 1;
      if (today.getDate() < joinDate.getDate()) totalCycles--;
      
      const fee = getMonthlyFee(student.classType);
      const totalDue = Math.max(0, (totalCycles * fee) - totalPaid);
      const pendingMonths = Math.ceil(totalDue / fee);

      return { ...student, totalDue, pendingMonths };
    }).filter(s => {
      const matchesSearch = !search || 
        s.studentName.toLowerCase().includes(search) || 
        s.phone.includes(search);
      return s.pendingMonths > 0 && matchesSearch;
    }).sort((a, b) => b.totalDue - a.totalDue);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    res.json({
      data: unpaid.slice(skip, skip + limit),
      total: unpaid.length,
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
    const joinDate = new Date(student.createdAt);
    
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

    // Send automated WhatsApp Welcome message (non-blocking)
    whatsapp.sendWelcomeMessage(newStudent, newStudent.studentName, newStudent.classType)
      .catch((e) => console.error('WhatsApp welcome error (Manual Add):', e));

    const io = req.app.get('socketio');
    if (io) io.emit('dataChanged', { type: 'student', action: 'create' });

    res.status(201).json(newStudent);
  } catch (err) {
    console.error('createStudent error:', err);
    if (err.name === 'ValidationError')
      return res.status(400).json({ message: formatValidationErrors(err).join('. ') });
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
    console.error('updateStudent error:', err);
    if (err.name === 'CastError')
      return res.status(400).json({ message: 'Invalid student ID format.' });
    if (err.name === 'ValidationError')
      return res.status(400).json({ message: formatValidationErrors(err).join('. ') });
    res.status(500).json({ message: 'Server error. Could not update student.' });
  }
};

// ─── PATCH /api/students/:id/toggle-status ───────────────────────────────────
exports.toggleStatus = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const wasActive = student.isActive !== false;
    student.isActive = !wasActive;

    // When reactivating (Inactive -> Active), reset joining date to today
    if (student.isActive && !wasActive) {
      student.createdAt = new Date();
      console.log(`📣 [ToggleStatus] ${student.studentName} is now ACTIVE (Re-joined). Resetting join date and triggering Welcome message...`);
      
      // Send standard Welcome message for a fresh start
      whatsapp.sendWelcomeMessage(student, student.studentName, student.classType)
        .then(res => {
          if (res.success) console.log(`✅ [ToggleStatus] Welcome message sent to ${student.studentName}`);
          else console.warn(`⚠️ [ToggleStatus] Welcome message FAILED for ${student.studentName}: ${res.reason}`);
        })
        .catch(err => console.error(`❌ [ToggleStatus] WhatsApp Error (Welcome) for ${student.studentName}:`, err.message));
    } 
    
    // When inactivating (Active -> Inactive), send rejoin invitation
    if (student.isActive === false) {
      console.log(`📣 [ToggleStatus] ${student.studentName} is now INACTIVE. Student is now "Inactivated from Payment". Triggering Rejoin Invitation...`);
      whatsapp.sendRejoinMessage(student, student.studentName, student.classType)
        .then(res => {
          if (res.success) console.log(`✅ [ToggleStatus] Rejoin Invitation sent to ${student.studentName}`);
          else console.warn(`⚠️ [ToggleStatus] Rejoin Invitation FAILED for ${student.studentName}: ${res.reason}`);
        })
        .catch(err => console.error(`❌ [ToggleStatus] WhatsApp Error for ${student.studentName}:`, err.message));
    }

    await student.save();

    const io = req.app.get('socketio');
    if (io) io.emit('dataChanged', { type: 'student', action: 'statusToggle' });

    res.json({
      message: `Student marked as ${student.isActive ? 'Active' : 'Inactive'}. ${student.isActive ? 'Join date reset to today.' : 'Student inactivated from payment system.'}`,
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

// ─── GET /api/activity (Paginated Log) ──────────────────────────────────────
exports.getActivityLog = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [pays, regs, totalPays, totalRegs] = await Promise.all([
      Payment.find()
        .populate('studentId', 'studentName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      require('../models/Registration').find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(),
      require('../models/Registration').countDocuments()
    ]);

    const combined = [
      ...pays.map(p => ({ 
        type: 'payment', 
        date: p.createdAt, 
        amount: p.amount, 
        purpose: p.purpose, 
        studentName: p.studentId?.studentName || 'Unknown Student',
        id: p._id 
      })),
      ...regs.map(r => ({ 
        type: 'reg', 
        date: r.createdAt, 
        studentName: r.studentName, 
        classType: r.classType,
        id: r._id 
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);

    res.json({
      data: combined,
      total: totalPays + totalRegs,
      page,
      limit,
      totalPages: Math.ceil((totalPays + totalRegs) / limit)
    });
  } catch (err) {
    console.error('getActivityLog error:', err);
    res.status(500).json({ message: 'Failed to fetch activity log.' });
  }
};

