/**
 * Admin screens for referral codes: see every student's code, its history, who they referred,
 * and generate / regenerate a code for a student.
 */
const Student      = require('../models/Student');
const Registration = require('../models/Registration');
const { normalizeCode } = require('../utils/referral');
const { studentSearchClauses, escapeRegex } = require('../utils/search');
const { cycleLabel, createFirstCode, replaceCode, classesOf } = require('./referralController');
const { REFERRAL_PERCENT } = require('../utils/fees');

const ROW_FIELDS = 'studentName phone whatsappNumber classType extraClasses isActive createdAt referralCode referralCodeCreatedAt referralCodeHistory referralRewards';

// search by name / phone, or by (the start of) a referral code — current or expired
const searchQuery = (search) => {
  const s = String(search || '').trim();
  if (!s) return {};
  const clauses = studentSearchClauses(s);
  const code = normalizeCode(s);
  if (code.length >= 3) {
    clauses.push({ referralCode: { $regex: `^${escapeRegex(code)}` } });
    clauses.push({ 'referralCodeHistory.code': { $regex: `^${escapeRegex(code)}` } });
  }
  return { $or: clauses };
};

// ─── GET /api/referrals?search=&filter=withCode|noCode|all&page=&limit= ─────────
exports.list = async (req, res) => {
  try {
    const filter = ['withCode', 'noCode', 'all'].includes(req.query.filter) ? req.query.filter : 'withCode';
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const base   = searchQuery(req.query.search);

    const hasCode = { referralCode: { $exists: true, $ne: null } };
    const noCode  = { $or: [{ referralCode: { $exists: false } }, { referralCode: null }] };
    const and = (...parts) => ({ $and: parts.filter(p => Object.keys(p).length) });

    const query = filter === 'withCode' ? and(base, hasCode) : filter === 'noCode' ? and(base, noCode) : base;
    const finalQuery = query.$and && !query.$and.length ? {} : query;

    const [total, withCodeCount, noCodeCount, allCount, students] = await Promise.all([
      Student.countDocuments(finalQuery),
      Student.countDocuments(and(base, hasCode)),
      Student.countDocuments(and(base, noCode)),
      Student.countDocuments(base),
      Student.find(finalQuery).select(ROW_FIELDS).sort({ referralCodeCreatedAt: -1, studentName: 1 }).skip((page - 1) * limit).limit(limit).lean()
    ]);

    // friends who registered with this student's code and are still waiting for the admin
    const ids = students.map(s => s._id);
    const codes = students.flatMap(s => [s.referralCode, ...(s.referralCodeHistory || []).map(h => h.code)]).filter(Boolean);
    const waiting = ids.length ? await Registration.find({
      status: 'pending',
      $or: [{ referrerStudentId: { $in: ids } }, { referralCode: { $in: codes } }]
    }).select('referralCode referrerStudentId').lean() : [];
    const ownerOfCode = new Map();
    for (const s of students) { if (s.referralCode) ownerOfCode.set(s.referralCode, String(s._id)); for (const h of (s.referralCodeHistory || [])) ownerOfCode.set(h.code, String(s._id)); }
    const pendingBy = new Map();
    for (const r of waiting) {
      const owner = r.referrerStudentId ? String(r.referrerStudentId) : ownerOfCode.get(r.referralCode);
      if (owner) pendingBy.set(owner, (pendingBy.get(owner) || 0) + 1);
    }

    res.json({
      data: students.map(s => ({
        _id: s._id,
        studentName: s.studentName,
        phone: s.phone,
        classes: classesOf(s),
        isActive: s.isActive !== false,
        referralCode: s.referralCode || null,
        referralCodeCreatedAt: s.referralCodeCreatedAt || null,
        expiredCodes: (s.referralCodeHistory || []).length,
        friendsAccepted: (s.referralRewards || []).length,
        friendsWaiting: pendingBy.get(String(s._id)) || 0
      })),
      total, page, limit, totalPages: Math.ceil(total / limit) || 1,
      counts: { withCode: withCodeCount, noCode: noCodeCount, all: allCount },
      percent: REFERRAL_PERCENT
    });
  } catch (err) {
    console.error('referral admin list error:', err);
    res.status(500).json({ message: 'Could not load the referral codes.' });
  }
};

// ─── GET /api/referrals/:studentId ─────────────────────────────────────────────
// Everything about one student's referrals: current code, expired codes, friends who joined or are waiting.
exports.details = async (req, res) => {
  try {
    const s = await Student.findById(req.params.studentId).select(ROW_FIELDS).lean();
    if (!s) return res.status(404).json({ message: 'Student not found.' });

    const history = [...(s.referralCodeHistory || [])].sort((a, b) => new Date(b.expiredAt) - new Date(a.expiredAt));
    const allCodes = [s.referralCode, ...history.map(h => h.code)].filter(Boolean);
    const friends = await Registration.find({ $or: [{ referrerStudentId: s._id }, { referralCode: { $in: allCodes } }] })
      .select('studentName phone status createdAt referralCode referralResult referralNote').sort({ createdAt: -1 }).lean();

    res.json({
      student: { _id: s._id, studentName: s.studentName, phone: s.phone, classes: classesOf(s), isActive: s.isActive !== false },
      referralCode: s.referralCode || null,
      referralCodeCreatedAt: s.referralCodeCreatedAt || null,
      history,
      rewards: (s.referralRewards || []).map(r => ({
        friend: r.refereeName, percent: r.percent, bill: cycleLabel(s.createdAt || s.joinDate, r.cycle), grantedAt: r.grantedAt
      })),
      friends: friends.map(f => ({
        _id: f._id, name: f.studentName, phone: f.phone, status: f.status, registeredAt: f.createdAt,
        codeUsed: f.referralCode, codeExpiredNow: !!f.referralCode && f.referralCode !== s.referralCode,
        result: f.referralResult || null, note: f.referralNote || ''
      })),
      percent: REFERRAL_PERCENT
    });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid student ID format.' });
    console.error('referral admin details error:', err);
    res.status(500).json({ message: 'Could not load the referral details.' });
  }
};

const loadActiveStudent = async (id) => {
  let student = null;
  try { student = await Student.findById(id).lean(); } catch (e) { return { status: 400, message: 'Invalid student ID format.' }; }
  if (!student) return { status: 404, message: 'Student not found.' };
  if (student.isActive === false) return { status: 400, message: 'This student is inactive. Reactivate the student before creating a referral code.' };
  return { student };
};

// ─── POST /api/referrals/:studentId/generate ───────────────────────────────────
// Creates the first code. A student who already has one must be regenerated instead.
exports.generate = async (req, res) => {
  try {
    const loaded = await loadActiveStudent(req.params.studentId);
    if (loaded.message) return res.status(loaded.status).json({ message: loaded.message });
    if (loaded.student.referralCode)
      return res.status(409).json({ message: 'This student already has a referral code. Use Regenerate to replace it.', referralCode: loaded.student.referralCode });
    await createFirstCode(loaded.student);
    const io = req.app.get('socketio'); if (io) io.emit('dataChanged', { type: 'referral', action: 'generate' });
    res.status(201).json({ referralCode: loaded.student.referralCode });
  } catch (err) {
    console.error('referral admin generate error:', err);
    res.status(500).json({ message: 'Could not create the code. Please try again.' });
  }
};

// ─── POST /api/referrals/:studentId/regenerate ─────────────────────────────────
// The current code expires at once (kept in the history) and a new one is issued.
exports.regenerate = async (req, res) => {
  try {
    const loaded = await loadActiveStudent(req.params.studentId);
    if (loaded.message) return res.status(loaded.status).json({ message: loaded.message });
    const { student } = loaded;
    let result;
    if (!student.referralCode) { await createFirstCode(student); result = { referralCode: student.referralCode, previousCode: null }; }
    else result = await replaceCode(student, 'admin');
    const io = req.app.get('socketio'); if (io) io.emit('dataChanged', { type: 'referral', action: 'regenerate' });
    res.json(result);
  } catch (err) {
    console.error('referral admin regenerate error:', err);
    res.status(500).json({ message: 'Could not create a new code. Please try again.' });
  }
};
