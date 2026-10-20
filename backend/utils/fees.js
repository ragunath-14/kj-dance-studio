// Single source of truth for class types, monthly fees and discounts (backend).
// The frontend mirrors this in frontend/src/classCatalog.js — keep them in sync.

const CLASS_TYPES = [
  'Regular Class', 'Fitness Class', 'Online Class',
  'Karate Class', 'Zumba Class', 'Silambam Class', 'Art & Craft Class'
];

const ZUMBA_PLANS = ['5 Class', '3 Class'];

// Fee for ONE class
const getMonthlyFee = (classType, studentCategory, feePlan) => {
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

// A student's classes: the primary one plus any extras taken alongside it
const getClassEntries = (s) => [
  { classType: s.classType, feePlan: s.feePlan, batchTiming: s.batchTiming },
  ...((s.extraClasses || []).map(e => ({ classType: e.classType, feePlan: e.feePlan, batchTiming: e.batchTiming })))
];

// Monthly fee before any discount: sum of every class the student takes
const getBaseFee = (s) =>
  getClassEntries(s).reduce((sum, e) => sum + getMonthlyFee(e.classType, s.studentCategory, e.feePlan), 0);

// Referral reward: 10% off one bill for every new student the referrer brought in
const REFERRAL_PERCENT = 10;
const getReferralPercentForCycle = (s, cycleIndex) =>
  (s.referralRewards || []).filter(r => r.cycle === cycleIndex).reduce((sum, r) => sum + (r.percent || 0), 0);

// Discount for one monthly bill = % of the base fee + a flat amount, never more than the fee.
// `discounts` is a history [{ fromCycle, percent, amount }]; the latest entry whose fromCycle
// has been reached applies, so changing an offer never rewrites bills that were already issued.
const getDiscountForCycle = (s, cycleIndex, base = getBaseFee(s)) => {
  let entry = null;
  for (const d of (s.discounts || [])) if (d.fromCycle <= cycleIndex) entry = d;
  const offer = entry ? Math.round(base * (entry.percent || 0) / 100) + (entry.amount || 0) : 0;
  // referral rewards are one-cycle discounts; several in the same cycle add up (10% + 10% = 20%)
  const refPercent = getReferralPercentForCycle(s, cycleIndex);
  const referral = Math.round(base * refPercent / 100);
  return Math.max(0, Math.min(base, offer + referral));
};

const getFeeForCycle = (s, cycleIndex, base = getBaseFee(s)) => base - getDiscountForCycle(s, cycleIndex, base);

// Fee a student is being billed from now on (after the latest discount)
const getNetFee = (s) => getFeeForCycle(s, Number.MAX_SAFE_INTEGER);

// Everything billed across `totalCycles` months (cycle 0 = joining month)
const getExpectedTotal = (s, totalCycles) => {
  const base = getBaseFee(s);
  let total = 0;
  for (let i = 0; i < totalCycles; i++) total += getFeeForCycle(s, i, base);
  return total;
};

// How many billed months still have something owing. Payments are applied to the oldest
// months first, so a month counts as paid only once the money received covers it in full.
// (Dividing the amount owed by the current fee would be wrong once an offer changes the fee.)
const getPendingMonths = (s, totalCycles, totalPaid) => {
  const base = getBaseFee(s);
  let remaining = totalPaid;
  let covered = 0;
  for (let i = 0; i < totalCycles; i++) {
    const fee = getFeeForCycle(s, i, base);
    if (remaining >= fee) { remaining -= fee; covered++; } else break;
  }
  return Math.max(0, totalCycles - covered);
};

// Month-by-month view of what has been billed and paid. Money received is applied to the OLDEST
// unpaid month first, so this always agrees with "total billed - total paid" (the Unpaid list,
// dashboard and reminders). `credit` is any money left over after every billed month is covered.
const getMonthlyBreakdown = (s, totalCycles, totalPaid) => {
  const base = getBaseFee(s);
  let remaining = totalPaid;
  const rows = [];
  for (let i = 0; i < totalCycles; i++) {
    const fee = getFeeForCycle(s, i, base);
    const applied = Math.min(remaining, fee);
    remaining -= applied;
    const due = fee - applied;
    rows.push({ cycle: i, fee, paid: applied, due, status: due === 0 ? 'paid' : (applied > 0 ? 'partial' : 'pending') });
  }
  return { rows, credit: remaining };
};

// Calendar month a billing cycle falls in (cycle 0 = the joining month)
const getCycleMonth = (joinDate, cycle) => {
  const j = new Date(joinDate);
  const d = new Date(j.getFullYear(), j.getMonth() + cycle, 1);
  return { month: d.getMonth(), year: d.getFullYear() };
};

// Months elapsed since joining, including the current one (same rule used everywhere)
const getTotalCycles = (createdAt, today = new Date()) => {
  const joinDate = new Date(createdAt);
  let cycles = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth()) + 1;
  if (today.getDate() < joinDate.getDate()) cycles--;
  return cycles;
};

// Where an offer given today should start (cycle 0 = joining month):
//  - nothing owed at all                      -> next bill
//  - this month's bill already paid           -> next bill (older unpaid months keep their fee)
//  - otherwise (current bill still unpaid)    -> the current bill
// `payments` = the student's payment records (only 'Monthly Fee' ones count).
const getDiscountTiming = (s, payments = [], today = new Date()) => {
  const join      = new Date(s.createdAt || s.joinDate);
  const cyclesDue = getTotalCycles(join, today);
  if (cyclesDue <= 0) return { fromCycle: 0, appliesFrom: 'current' }; // billing hasn't started: first bill gets it

  const monthly   = payments.filter(p => p.purpose === 'Monthly Fee');
  const totalPaid = monthly.reduce((sum, p) => sum + (p.amount || 0), 0);
  if (totalPaid >= getExpectedTotal(s, cyclesDue)) return { fromCycle: cyclesDue, appliesFrom: 'next' };

  // Payments are recorded against a calendar month - has this month's bill been paid?
  const todayIdx = (today.getFullYear() - join.getFullYear()) * 12 + (today.getMonth() - join.getMonth());
  const paidThisMonth = monthly
    .filter(p => p.forYear === today.getFullYear() && p.forMonth === today.getMonth())
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  if (todayIdx >= 0 && paidThisMonth >= getFeeForCycle(s, todayIdx)) return { fromCycle: todayIdx + 1, appliesFrom: 'next' };

  return { fromCycle: cyclesDue - 1, appliesFrom: 'current' };
};

// Returns a new discounts history with `{ percent, amount }` starting at `fromCycle`
const withDiscount = (discounts, fromCycle, percent, amount) => {
  const kept = (discounts || []).filter(d => d.fromCycle < fromCycle).map(d => ({ fromCycle: d.fromCycle, percent: d.percent, amount: d.amount }));
  kept.push({ fromCycle, percent, amount });
  return kept;
};

// Validates the percent / amount an admin typed; returns { percent, amount } or { error }
const parseDiscountInput = (body = {}) => {
  const percent = Number(body.discountPercent || 0);
  const amount  = Number(body.discountAmount  || 0);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return { error: 'Discount percentage must be between 0 and 100.' };
  if (!Number.isFinite(amount)  || amount < 0)                    return { error: 'Discount amount cannot be negative.' };
  return { percent, amount: Math.round(amount) };
};

// Class selection rules shared by registration and student create/update.
// Returns an error message, or '' when valid.
const validateClasses = (classType, feePlan, extraClasses = []) => {
  const entries = [{ classType: classType || 'Dance Class', feePlan }, ...extraClasses];
  const seen = new Set();
  for (const e of entries) {
    if (!CLASS_TYPES.includes(e.classType) && e.classType !== 'Dance Class') return `${e.classType} is not a valid class type`;
    if (seen.has(e.classType)) return `${e.classType} is selected more than once.`;
    seen.add(e.classType);
    if (e.classType === 'Zumba Class' && !ZUMBA_PLANS.includes(e.feePlan))
      return 'Please choose a Zumba plan: 5 classes or 3 classes a week.';
  }
  return '';
};

module.exports = {
  CLASS_TYPES, ZUMBA_PLANS, REFERRAL_PERCENT, getReferralPercentForCycle,
  getMonthlyFee, getClassEntries, getBaseFee,
  getDiscountForCycle, getFeeForCycle, getNetFee, getExpectedTotal, getPendingMonths, getMonthlyBreakdown, getCycleMonth,
  getTotalCycles, getDiscountTiming, withDiscount, parseDiscountInput, validateClasses
};
