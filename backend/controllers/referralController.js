const Student      = require('../models/Student');
const Registration = require('../models/Registration');
const Payment      = require('../models/Payment');
const { normalizeCode, last10, phoneRegex, samePhone, generateUniqueCode } = require('../utils/referral');
const { getTotalCycles, getDiscountTiming, REFERRAL_PERCENT, getReferralPercentForCycle } = require('../utils/fees');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CODE_LENGTH = 8; // "KJ" + 6 characters

const classesOf = (s) => [s.classType, ...(s.extraClasses || []).map(e => e.classType)].filter(Boolean);

// "Nov 2026" for billing cycle `cycle` of a student who joined on `joinDate`
const cycleLabel = (joinDate, cycle) => {
  const d = new Date(new Date(joinDate).getFullYear(), new Date(joinDate).getMonth() + cycle, 1);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
};

// ─── Why a code cannot be used, in words a visitor understands ─────────────────
// Each problem has a short title, one sentence explaining it and the steps to fix it.
// The same text is used by the "check code" endpoint, the registration form and the admin screens.
const PROBLEMS = {
  incomplete: {
    title: 'The code is not complete',
    message: 'A referral code has 8 letters and numbers, and always starts with KJ.',
    steps: ['Type the whole code, for example KJ7QH4MZ.', 'Ask your friend to send it again with the Copy or WhatsApp button on our website.', 'No code? You can leave the box empty and register without it.']
  },
  unknown: {
    title: 'We could not find this code',
    message: 'No student has a referral code like this.',
    steps: ['Check for typing mistakes. The letters I, L, O and the numbers 0 and 1 are never used in codes.', 'Ask your friend to copy the code from the Refer & Save part of our website and send it to you.', 'No code? You can leave the box empty and register without it.']
  },
  expired: {
    title: 'This code has expired',
    message: 'The student who owns this code made a new one, so the old code no longer works.',
    steps: ['Ask your friend for their NEW code — they can see it in the Refer & Save part of our website.', 'Enter the new code here.', 'No code? You can leave the box empty and register without it.']
  },
  inactive: {
    title: 'This code is no longer active',
    message: 'The student who owns this code is not currently enrolled, so the code cannot be used.',
    steps: ['Ask another friend who studies with us for their code.', 'No code? You can leave the box empty and register without it.']
  },
  own_phone: {
    title: 'You cannot use your own code',
    message: 'This code belongs to the same phone number you are registering with.',
    steps: ['Referral codes are for friends who are new to the studio.', 'Use a different code, or leave the box empty.']
  },
  already_registered: {
    title: 'Referral codes are for new students',
    message: 'This student is already registered at the studio, so a referral code cannot be used.',
    steps: ['If you are already a student, you do not need to register again — contact the studio.', 'If this is a different person, check the name and phone number you typed.']
  }
};

const problem = (reason, extra = {}) => ({ valid: false, reason, ...PROBLEMS[reason], ...extra });

// Finds the student a code belongs to — the CURRENT code, or an expired (old) one.
const findByCode = async (code) => {
  const normalized = normalizeCode(code);
  if (!normalized) return { owner: null, expired: false, code: '' };
  const current = await Student.findOne({ referralCode: normalized }).lean();
  if (current) return { owner: current, expired: false, code: normalized };
  const old = await Student.findOne({ 'referralCodeHistory.code': normalized }).lean();
  if (old) return { owner: old, expired: true, code: normalized };
  return { owner: null, expired: false, code: normalized };
};

// What the student sees about their own referrals: how many were accepted and which bills get a reward
const summarise = (s) => {
  const join = s.createdAt || s.joinDate;
  const cyclesDue = Math.max(0, getTotalCycles(join));
  const rewards = s.referralRewards || [];
  const cycles = [...new Set(rewards.map(r => r.cycle))].filter(c => c >= cyclesDue - 1).sort((a, b) => a - b);
  return {
    id: s._id,
    studentName: s.studentName,
    classes: classesOf(s),
    isActive: s.isActive !== false,
    joinedOn: join,
    referralCode: s.referralCode || null,
    referralCodeCreatedAt: s.referralCodeCreatedAt || null,
    expiredCodes: (s.referralCodeHistory || []).length,
    referralsAccepted: rewards.length,
    upcomingRewards: cycles.map(c => ({ month: cycleLabel(join, c), percent: getReferralPercentForCycle(s, c) }))
  };
};

// ─── POST /api/referral/lookup  { phone } ───────────────────────────────────────
// Public. Finds ACCEPTED students (real student records) by phone / WhatsApp number.
// Only non-sensitive details come back: name, classes, status and the referral summary.
exports.lookup = async (req, res) => {
  try {
    const digits = last10(req.body?.phone);
    if (digits.length !== 10)
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit phone number.' });

    const re = phoneRegex(digits);
    const students = await Student.find({ $or: [{ phone: re }, { whatsappNumber: re }] })
      .select('studentName classType extraClasses isActive createdAt referralCode referralCodeCreatedAt referralCodeHistory referralRewards')
      .sort({ createdAt: 1 }).lean();

    if (students.length)
      return res.json({ success: true, found: true, students: students.map(summarise) });

    // Not an accepted student — maybe the registration is still waiting for the admin
    const pending = await Registration.exists({ status: 'pending', $or: [{ phone: re }, { whatsappNumber: re }] });
    res.json({ success: true, found: false, pending: !!pending });
  } catch (err) {
    console.error('referral lookup error:', err);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

// The student proves who they are with a phone number that belongs to their record.
const loadStudentForPhone = async (studentId, phone) => {
  let student = null;
  try { student = await Student.findById(studentId); } catch (e) { /* invalid id */ }
  if (!student || !(samePhone(phone, student.phone) || samePhone(phone, student.whatsappNumber)))
    return { status: 404, message: 'Student not found for this phone number.' };
  if (student.isActive === false)
    return { status: 403, message: 'This student account is inactive. Please contact the studio to reactivate it.' };
  return { student };
};

// Creates the first code for a student who has none. Safe if two requests race: the unique index decides.
const createFirstCode = async (student) => {
  for (let attempt = 0; attempt < 5 && !student.referralCode; attempt++) {
    const code = await generateUniqueCode(Student);
    try {
      const updated = await Student.findOneAndUpdate(
        { _id: student._id, referralCode: { $exists: false } },
        { $set: { referralCode: code, referralCodeCreatedAt: new Date() } },
        { new: true }
      ).lean();
      // null = someone else created it a moment ago; read it back
      const fresh = updated || await Student.findById(student._id).lean();
      student.referralCode = fresh.referralCode;
      student.referralCodeCreatedAt = fresh.referralCodeCreatedAt;
    } catch (e) {
      if (e.code !== 11000) throw e; // duplicate code: try another one
    }
  }
  return student.referralCode;
};

// Expires the current code (kept in the history) and issues a new one.
// `by` = 'student' | 'admin'. Returns { referralCode, previousCode }.
const replaceCode = async (student, by) => {
  const previous = student.referralCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await generateUniqueCode(Student);
    try {
      const now = new Date();
      const updated = await Student.findOneAndUpdate(
        { _id: student._id, referralCode: previous },   // only if nobody replaced it in the meantime
        {
          $set: { referralCode: code, referralCodeCreatedAt: now },
          $push: { referralCodeHistory: { code: previous, createdAt: student.referralCodeCreatedAt, expiredAt: now, expiredBy: by } }
        },
        { new: true }
      ).lean();
      if (!updated) {
        const fresh = await Student.findById(student._id).lean();   // another request already replaced it
        return { referralCode: fresh.referralCode, previousCode: previous, alreadyReplaced: true };
      }
      return { referralCode: updated.referralCode, previousCode: previous };
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  }
  throw new Error('Could not create a new referral code. Please try again.');
};

// ─── POST /api/referral/generate  { studentId, phone } ──────────────────────────
// Public. Creates the student's referral code (once). Asking again returns the same code.
exports.generate = async (req, res) => {
  try {
    const { studentId, phone } = req.body || {};
    if (!studentId || !phone)
      return res.status(400).json({ success: false, message: 'Student and phone number are required.' });

    const found = await loadStudentForPhone(studentId, phone);
    if (found.message) return res.status(found.status).json({ success: false, message: found.message });

    await createFirstCode(found.student);
    res.json({ success: true, referralCode: found.student.referralCode, percent: REFERRAL_PERCENT });
  } catch (err) {
    console.error('referral generate error:', err);
    res.status(500).json({ success: false, message: 'Could not create the code. Please try again.' });
  }
};

// ─── POST /api/referral/regenerate  { studentId, phone } ────────────────────────
// Public. The current code expires immediately (it moves to the history) and a new one is issued.
exports.regenerate = async (req, res) => {
  try {
    const { studentId, phone } = req.body || {};
    if (!studentId || !phone)
      return res.status(400).json({ success: false, message: 'Student and phone number are required.' });

    const found = await loadStudentForPhone(studentId, phone);
    if (found.message) return res.status(found.status).json({ success: false, message: found.message });
    const { student } = found;

    if (!student.referralCode) {            // nothing to replace yet: this is simply the first code
      await createFirstCode(student);
      return res.json({ success: true, referralCode: student.referralCode, previousCode: null, percent: REFERRAL_PERCENT });
    }
    const result = await replaceCode(student, 'student');
    res.json({ success: true, percent: REFERRAL_PERCENT, ...result });
  } catch (err) {
    console.error('referral regenerate error:', err);
    res.status(500).json({ success: false, message: 'Could not create a new code. Please try again.' });
  }
};

// ─── GET /api/referral/check/:code ──────────────────────────────────────────────
// Public. Lets the registration form tell the user straight away whether a code works —
// and, when it does not, exactly why and what to do about it.
exports.check = async (req, res) => {
  try {
    const code = normalizeCode(req.params.code);
    if (code.length !== CODE_LENGTH) return res.json(problem('incomplete'));
    const { owner, expired } = await findByCode(code);
    if (!owner) return res.json(problem('unknown'));
    if (expired) return res.json(problem('expired', { referrerName: String(owner.studentName).split(' ')[0] }));
    if (owner.isActive === false) return res.json(problem('inactive'));
    res.json({ valid: true, referrerName: String(owner.studentName).split(' ')[0] });
  } catch (err) {
    res.status(500).json({ valid: false, reason: 'server', title: 'We could not check the code', message: 'Something went wrong on our side.', steps: ['Please try again in a moment.'] });
  }
};

// ─── used by the registration controller ───────────────────────────────────────

// Validates a code typed on the registration form. Returns { code, referrer } when usable,
// { code: '' } when nothing was typed, or { error, reason, title, steps } when it cannot be used.
exports.validateForRegistration = async ({ code, phone, whatsappNumber, studentName }) => {
  const normalized = normalizeCode(code);
  if (!normalized) return { code: '' };
  const fail = (reason) => ({ error: PROBLEMS[reason].message, reason, title: PROBLEMS[reason].title, steps: PROBLEMS[reason].steps });

  if (normalized.length !== CODE_LENGTH) return fail('incomplete');
  const { owner, expired } = await findByCode(normalized);
  if (!owner) return fail('unknown');
  if (expired) return fail('expired');
  if (owner.isActive === false) return fail('inactive');

  // Your own code (or one from the same phone number) doesn't count
  if (samePhone(phone, owner.phone) || samePhone(phone, owner.whatsappNumber) ||
      samePhone(whatsappNumber, owner.phone) || samePhone(whatsappNumber, owner.whatsappNumber))
    return fail('own_phone');

  // Referral codes are for NEW students only
  const existing = await Student.exists({ phone: String(phone || '').trim(), studentName: String(studentName || '').trim() });
  if (existing) return fail('already_registered');

  return { code: normalized, referrer: owner };
};

// Called when the admin accepts a registration that carries a referral code.
// Gives the referrer REFERRAL_PERCENT% off one bill: the current bill if it is still unpaid,
// otherwise next month's. Idempotent — the same new student can never reward twice.
// A code that was valid when the friend registered still counts if its owner has made a new one since.
exports.grantReward = async (registration, newStudent) => {
  const code = normalizeCode(registration.referralCode);
  if (!code) return null;

  let referrer = null;
  if (registration.referrerStudentId) referrer = await Student.findById(registration.referrerStudentId).lean();
  if (!referrer) referrer = (await findByCode(code)).owner;
  if (!referrer)
    return { result: 'skipped', note: 'The referral code owner no longer exists, so no reward was given.' };
  if (String(referrer._id) === String(newStudent._id))
    return { result: 'skipped', note: 'A student cannot refer themselves.' };
  if (referrer.isActive === false)
    return { result: 'skipped', note: `${referrer.studentName} is inactive, so no reward was given.` };
  if (samePhone(newStudent.phone, referrer.phone) || samePhone(newStudent.phone, referrer.whatsappNumber))
    return { result: 'skipped', note: 'Same phone number as the referrer, so no reward was given.' };

  const payments = await Payment.find({ studentId: referrer._id, purpose: 'Monthly Fee' }).lean();
  const { fromCycle } = getDiscountTiming(referrer, payments);

  const updated = await Student.findOneAndUpdate(
    { _id: referrer._id, 'referralRewards.refereeStudentId': { $ne: newStudent._id } },
    { $push: { referralRewards: { refereeStudentId: newStudent._id, refereeName: newStudent.studentName, percent: REFERRAL_PERCENT, cycle: fromCycle } } },
    { new: true }
  ).lean();
  if (!updated) return { result: 'skipped', note: 'This referral was already rewarded.' };

  const total = getReferralPercentForCycle(updated, fromCycle);
  const month = cycleLabel(updated.createdAt || updated.joinDate, fromCycle);
  return {
    result: 'rewarded',
    referrerId: referrer._id,
    referrerName: referrer.studentName,
    percent: REFERRAL_PERCENT,
    totalPercentThatBill: total,
    month,
    note: `${referrer.studentName} gets ${REFERRAL_PERCENT}% off the ${month} bill (${total}% in total for that bill).`
  };
};

// Shared with the admin screens
exports.cycleLabel = cycleLabel;
exports.findByCode = findByCode;
exports.createFirstCode = createFirstCode;
exports.replaceCode = replaceCode;
exports.PROBLEMS = PROBLEMS;
exports.CODE_LENGTH = CODE_LENGTH;
exports.classesOf = classesOf;
