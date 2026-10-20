// Class types, schedules and fees shown on the registration form and used by the admin UI.
// Fees mirror backend/utils/fees.js — keep the two in sync.

export const STANDARD_CLASSES = ['Regular Class', 'Fitness Class', 'Online Class'];

// Classes with a fixed timetable and fee (from the "Admission Open" posters).
// `batches` / `plans` are only set for classes where the student must pick one.
export const SPECIAL_CLASSES = {
  'Karate Class': {
    short: 'Karate',
    days: 'Mon · Wed · Fri',
    timing: '5:00 PM – 7:00 PM',
    feeText: '₹1300 / month',
    about: 'Self defence + fitness + confidence. Learn karate, build a better you.',
    schedule: [{ name: 'Evening Batch', days: ['Mon', 'Wed', 'Fri'], time: '5:00 PM – 7:00 PM', short: '5–7 PM' }],
    details: [
      ['Class Days', 'Monday · Wednesday · Friday'],
      ['Class Timing', '5:00 PM to 7:00 PM (Evening)'],
      ['Fee', '₹1300 / month'],
    ],
  },
  'Zumba Class': {
    short: 'Zumba',
    days: 'Mon to Fri',
    timing: '6–7 AM or 10:30–11:30 AM',
    feeText: '₹1800 – ₹2000 / month',
    about: 'Dance, sweat, be fit, be happy. Zumba is not just a workout, it’s a lifestyle.',
    schedule: [
      { name: 'Morning Batch 1', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], time: '6:00 AM – 7:00 AM', short: '6–7 AM' },
      { name: 'Morning Batch 2', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], time: '10:30 AM – 11:30 AM', short: '10:30–11:30 AM' },
    ],
    batches: ['Morning 6:00 AM – 7:00 AM', 'Morning 10:30 AM – 11:30 AM'],
    plans: [
      { value: '5 Class', label: '5 Classes / week', fee: 2000 },
      { value: '3 Class', label: '3 Classes / week', fee: 1800 },
    ],
    details: [
      ['Class Days', 'Monday to Friday'],
      ['Weekly Classes', '3 classes or 5 classes a week'],
      ['Batch 1', 'Morning 6:00 AM to 7:00 AM'],
      ['Batch 2', 'Morning 10:30 AM to 11:30 AM'],
      ['Fees', '5 classes ₹2000 · 3 classes ₹1800'],
    ],
  },
  'Silambam Class': {
    short: 'Silambam',
    days: 'Tue · Wed',
    timing: '7:00 PM – 8:00 PM',
    feeText: '₹800 / month',
    about: 'Traditional skill, modern confidence. Discipline builds strength.',
    schedule: [{ name: 'Evening Batch', days: ['Tue', 'Wed'], time: '7:00 PM – 8:00 PM', short: '7–8 PM' }],
    details: [
      ['Class Days', 'Tuesday · Wednesday'],
      ['Timing', 'Evening 7:00 PM to 8:00 PM'],
      ['Fees', '₹800 / month'],
    ],
  },
  'Art & Craft Class': {
    short: 'Art & Craft',
    days: 'Tue · Thu',
    timing: '6:00 PM – 7:00 PM',
    feeText: '₹1000 / month',
    about: 'Drawing and Art and Craft. Let your creativity shine.',
    schedule: [{ name: 'Evening Batch', days: ['Tue', 'Thu'], time: '6:00 PM – 7:00 PM', short: '6–7 PM' }],
    details: [
      ['Classes', 'Drawing · Painting · Handwriting · Art & Craft'],
      ['Class Days', 'Tuesday & Thursday'],
      ['Timing', 'Evening 6:00 PM to 7:00 PM'],
      ['Fees', '₹1000 only'],
    ],
  },
};

export const ALL_CLASS_TYPES = [...STANDARD_CLASSES, ...Object.keys(SPECIAL_CLASSES)];

export const isSpecialClass = (classType) => Object.prototype.hasOwnProperty.call(SPECIAL_CLASSES, classType);

// Timing stored on the student (batchTiming) for classes with one fixed slot.
export const fixedBatchTiming = (classType) => {
  const c = SPECIAL_CLASSES[classType];
  if (!c || c.batches) return '';
  return `${c.days}, ${c.timing}`;
};

export const getMonthlyFee = (classType, studentCategory, feePlan) => {
  switch (classType) {
    case 'Fitness Class':     return 2000;
    case 'Online Class':      return studentCategory === 'Kids' ? 1600 : 2000;
    case 'Karate Class':      return 1300;
    case 'Zumba Class':       return feePlan === '5 Class' ? 2000 : 1800;
    case 'Silambam Class':    return 800;
    case 'Art & Craft Class': return 1000;
    default:                  return studentCategory === 'Kids' ? 1000 : 1300;
  }
};

// ─── Multi-class fees and offers (mirrors backend/utils/fees.js) ────────────────

export const ZUMBA_CLASS = 'Zumba Class';

// Kids: age 1-9, Adults: age 10+ (Fitness is always Adults)
export const computeCategory = (age, classType) => {
  if (classType === 'Fitness Class') return 'Adults';
  const n = parseInt(age);
  if (!age || isNaN(n)) return 'Adults';
  return n <= 9 ? 'Kids' : 'Adults';
};

// A student's classes: the primary one plus any extras taken alongside it
export const getClassEntries = (s) => [
  { classType: s.classType, feePlan: s.feePlan, batchTiming: s.batchTiming },
  ...((s.extraClasses || []).map(e => ({ classType: e.classType, feePlan: e.feePlan, batchTiming: e.batchTiming }))),
];

// Monthly fee before any offer: the sum of every class
export const getBaseFee = (s) =>
  getClassEntries(s).reduce((sum, e) => sum + getMonthlyFee(e.classType, s.studentCategory, e.feePlan), 0);

// Offer for one monthly bill = % of the base fee + flat amount, never more than the fee
export const computeDiscount = (base, percent, amount) => {
  const raw = Math.round(base * (Number(percent) || 0) / 100) + (Number(amount) || 0);
  return Math.max(0, Math.min(base, raw));
};

// Referral rewards are one-cycle discounts; several in the same cycle add up (10% + 10% = 20%)
export const REFERRAL_PERCENT = 10;
const getReferralPercentForCycle = (s, cycleIndex) =>
  (s.referralRewards || []).filter(r => r.cycle === cycleIndex).reduce((sum, r) => sum + (r.percent || 0), 0);

const getDiscountForCycle = (s, cycleIndex, base) => {
  let entry = null;
  for (const d of (s.discounts || [])) if (d.fromCycle <= cycleIndex) entry = d;
  const offer = entry ? Math.round(base * (Number(entry.percent) || 0) / 100) + (Number(entry.amount) || 0) : 0;
  const referral = Math.round(base * getReferralPercentForCycle(s, cycleIndex) / 100);
  return Math.max(0, Math.min(base, offer + referral));
};

// "Nov 2026" for billing cycle `cycle` of a student who joined on `joinDate`
export const cycleLabel = (joinDate, cycle) => {
  const j = new Date(joinDate);
  return new Date(j.getFullYear(), j.getMonth() + cycle, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

export const getFeeForCycle = (s, cycleIndex, base = getBaseFee(s)) => base - getDiscountForCycle(s, cycleIndex, base);

// Fee being billed from now on, after the latest offer
export const getNetFee = (s) => getFeeForCycle(s, Number.MAX_SAFE_INTEGER);

// Everything billed across `totalCycles` months (cycle 0 = joining month)
export const getExpectedTotal = (s, totalCycles) => {
  const base = getBaseFee(s);
  let total = 0;
  for (let i = 0; i < totalCycles; i++) total += getFeeForCycle(s, i, base);
  return total;
};

export const getTotalCycles = (createdAt, today = new Date()) => {
  const joinDate = new Date(createdAt);
  let cycles = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth()) + 1;
  if (today.getDate() < joinDate.getDate()) cycles--;
  return cycles;
};

export const formatRupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
