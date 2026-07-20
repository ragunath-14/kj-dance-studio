const Attendance = require('../models/Attendance');
const Student    = require('../models/Student');

// ─── Normalize any date input to local midnight (day granularity) ────────────
const normalizeDate = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// ─── GET /api/attendance?date=&classType=&studentCategory=&classSchedule=&search= ─
// Returns the active student roster in alphabetical order, merged with that
// day's attendance marks (status is null when not yet marked).
exports.getAttendanceByDate = async (req, res) => {
  try {
    const date    = normalizeDate(req.query.date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const query = { isActive: { $ne: false } };
    if (req.query.classType)       query.classType       = req.query.classType;
    if (req.query.studentCategory) query.studentCategory = req.query.studentCategory;
    if (req.query.classSchedule)   query.classSchedule   = req.query.classSchedule;
    if (req.query.search) {
      query.$or = [
        { studentName: { $regex: req.query.search, $options: 'i' } },
        { phone:       { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const [students, records] = await Promise.all([
      Student.find(query)
        .select('studentName phone classType studentCategory classSchedule')
        .collation({ locale: 'en', strength: 2 })
        .sort({ studentName: 1 })
        .lean(),
      Attendance.find({ date: { $gte: date, $lt: nextDay } }).lean()
    ]);

    const statusByStudent = new Map(records.map(r => [r.studentId.toString(), r.status]));

    const roster = students.map(s => ({
      ...s,
      status: statusByStudent.get(s._id.toString()) || null
    }));

    res.json({ date: date.toISOString().slice(0, 10), data: roster });
  } catch (err) {
    console.error('getAttendanceByDate error:', err);
    res.status(500).json({ message: 'Failed to fetch attendance.' });
  }
};

// ─── POST /api/attendance/mark ────────────────────────────────────────────────
// Body: { studentId, date, status }. Upserts one record per student per day.
exports.markAttendance = async (req, res) => {
  try {
    const { studentId, date, status } = req.body;
    if (!studentId || !date || !status)
      return res.status(400).json({ message: 'studentId, date and status are required.' });

    const student = await Student.findById(studentId).select('_id');
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const normalizedDate = normalizeDate(date);

    const record = await Attendance.findOneAndUpdate(
      { studentId, date: normalizedDate },
      { studentId, date: normalizedDate, status, markedAt: new Date() },
      { new: true, upsert: true, runValidators: true }
    );

    const io = req.app.get('socketio');
    if (io) io.emit('dataChanged', { type: 'attendance', action: 'mark' });

    res.json(record);
  } catch (err) {
    if (err.name === 'ValidationError')
      return res.status(400).json({ message: Object.values(err.errors).map(e => e.message).join('. ') });
    if (err.name === 'CastError')
      return res.status(400).json({ message: 'Invalid student ID format.' });
    console.error('markAttendance error:', err);
    res.status(500).json({ message: 'Failed to mark attendance.' });
  }
};

// ─── GET /api/attendance/register?month=&year=&classType=&studentCategory=&classSchedule=&search= ─
// Day-by-day attendance detail for every active student in the given month,
// alphabetical order. Each month is independent — "Mark Attendance" only ever
// shows the selected date, so the register is what surfaces past months here
// in the "History" view once a month has rolled over.
exports.getAttendanceRegister = async (req, res) => {
  try {
    const today = new Date();
    const month = req.query.month !== undefined ? parseInt(req.query.month) : today.getMonth();
    const year  = req.query.year  !== undefined ? parseInt(req.query.year)  : today.getFullYear();
    const monthStart  = new Date(year, month, 1);
    const monthEnd    = new Date(year, month + 1, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const query = { isActive: { $ne: false } };
    if (req.query.classType)       query.classType       = req.query.classType;
    if (req.query.studentCategory) query.studentCategory = req.query.studentCategory;
    if (req.query.classSchedule)   query.classSchedule   = req.query.classSchedule;
    if (req.query.search) {
      query.$or = [
        { studentName: { $regex: req.query.search, $options: 'i' } },
        { phone:       { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const [students, records] = await Promise.all([
      Student.find(query)
        .select('studentName phone classType')
        .collation({ locale: 'en', strength: 2 })
        .sort({ studentName: 1 })
        .lean(),
      Attendance.find({ date: { $gte: monthStart, $lt: monthEnd } }).lean()
    ]);

    const daysByStudent = new Map();
    records.forEach(r => {
      const sid = r.studentId.toString();
      if (!daysByStudent.has(sid)) daysByStudent.set(sid, {});
      daysByStudent.get(sid)[new Date(r.date).getDate()] = r.status;
    });

    const register = students.map(s => {
      const days = daysByStudent.get(s._id.toString()) || {};
      let present = 0, absent = 0;
      Object.values(days).forEach(st => { if (st === 'Present') present++; else if (st === 'Absent') absent++; });
      return { ...s, days, present, absent, totalMarked: present + absent };
    });

    res.json({ month, year, daysInMonth, data: register });
  } catch (err) {
    console.error('getAttendanceRegister error:', err);
    res.status(500).json({ message: 'Failed to fetch attendance register.' });
  }
};

// ─── GET /api/attendance/student/:studentId ───────────────────────────────────
exports.getStudentAttendanceHistory = async (req, res) => {
  try {
    const records = await Attendance.find({ studentId: req.params.studentId })
      .sort({ date: -1 })
      .lean();
    res.json({ data: records });
  } catch (err) {
    if (err.name === 'CastError')
      return res.status(400).json({ message: 'Invalid student ID format.' });
    console.error('getStudentAttendanceHistory error:', err);
    res.status(500).json({ message: 'Failed to fetch attendance history.' });
  }
};
