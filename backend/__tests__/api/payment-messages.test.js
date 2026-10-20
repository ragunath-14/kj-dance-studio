'use strict';
/**
 * WhatsApp sent when the admin records a payment (the Pay button):
 *   1. a receipt for what was just paid — full OR part payment
 *   2. if money is still owed, the fee reminder with the REMAINING amount, after the receipt
 * Runs the real controller against a throwaway database with the WhatsApp send functions replaced by recorders.
 */
const test     = require('node:test');
const assert   = require('node:assert/strict');
const { createTestDb, mongoAvailable } = require('../helpers/testServer');

process.env.USE_META_API = 'false';
const Student  = require('../../models/Student');
const Payment  = require('../../models/Payment');
const whatsapp = require('../../services/whatsappService');

const calls = [];
let behaviour = {};   // { receiptFails, reminderFails, receiptThrows }
whatsapp.sendPaymentConfirmation = async (number, name, amount, purpose) => {
  if (behaviour.receiptThrows) throw new Error('network down');
  calls.push({ kind: 'receipt', number, name, amount, purpose });
  return behaviour.receiptFails ? { success: false, reason: 'boom' } : { success: true };
};
whatsapp.sendPendingFeesAlert = async (id, number, name, months, due) => {
  calls.push({ kind: 'remaining', number, name, months, due });
  return behaviour.reminderFails ? { success: false, reason: 'boom' } : { success: true };
};
const payments = require('../../controllers/paymentController');

let db;
test.before(async () => {
  assert.ok(await mongoAvailable(), 'A local MongoDB must be running for these tests.');
  db = await createTestDb();
});
test.after(async () => { if (db) await db.drop(); });
test.beforeEach(() => { calls.length = 0; behaviour = {}; });

const today = new Date();
const Y = today.getFullYear(), M = today.getMonth(), D = today.getDate();
const joinedAgo = (months) => new Date(Y, M - months, Math.max(1, D - 5), 12, 0, 0);
let seq = 0;
const tag = String(Date.now()).slice(-5);
const make = (label, over = {}) => Student.create({
  studentName: `${label} ${tag}`, phone: `92${tag}${String(++seq).padStart(3, '0')}`, studentAge: '30', studentCategory: 'Adults',
  classType: 'Karate Class', classSchedule: 'NA', createdAt: joinedAgo(2), ...over   // Karate 1300: 3 bills so far
});
const monthOf = (join, i) => { const d = new Date(join.getFullYear(), join.getMonth() + i, 1); return { forMonth: d.getMonth(), forYear: d.getFullYear() }; };

// Calls the controller like Express would
const pay = async (student, amount, over = {}) => {
  const out = {};
  const req = { body: { studentId: String(student._id), amount, purpose: 'Monthly Fee', method: 'Cash', date: new Date().toISOString(), ...monthOf(new Date(student.createdAt), 0), ...over }, app: { get: () => null } };
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
  const log = console.error; console.error = () => {};
  try { await payments.createPayment(req, res); await settle(); } finally { console.error = log; }
  return out;
};
// messages are sent in the background: wait until nothing new arrives
const settle = async () => { let last = -1; for (let i = 0; i < 40 && last !== calls.length; i++) { last = calls.length; await new Promise(r => setTimeout(r, 25)); } };
const mine = (s) => calls.filter(c => c.name === s.studentName);

test.describe('the Pay button sends WhatsApp', () => {
  test('a part payment: receipt for what was paid, THEN the remaining balance as a reminder', async () => {
    const s = await make('part');                                  // owes 3 x 1300 = 3900
    const r = await pay(s, 500);
    assert.equal(r.status, 201);
    assert.deepEqual(mine(s).map(c => c.kind), ['receipt', 'remaining']);          // order matters
    assert.equal(mine(s)[0].amount, 500);
    assert.deepEqual([mine(s)[1].due, mine(s)[1].months], [3400, 3]);              // 3900 - 500, all three months still open
    assert.equal(mine(s)[1].number, s.phone);
  });

  test('paying one whole month out of three: remaining is the other two', async () => {
    const s = await make('onemonth');
    await pay(s, 1300);
    assert.deepEqual([mine(s)[1].due, mine(s)[1].months], [2600, 2]);
  });

  test('paying everything that is owed: only the receipt, no reminder', async () => {
    const s = await make('full');
    const first = await pay(s, 1300, monthOf(new Date(s.createdAt), 0));
    await pay(s, 1300, monthOf(new Date(s.createdAt), 1));
    calls.length = 0;
    const last = await pay(s, 1300, monthOf(new Date(s.createdAt), 2));
    assert.equal(first.status, 201); assert.equal(last.status, 201);
    assert.deepEqual(mine(s).map(c => c.kind), ['receipt']);
  });

  test('a second part payment reports what is left after BOTH payments', async () => {
    const s = await make('twoparts');
    await pay(s, 500);
    calls.length = 0;
    await pay(s, 700, monthOf(new Date(s.createdAt), 0));
    assert.deepEqual(mine(s).map(c => c.kind), ['receipt', 'remaining']);
    assert.equal(mine(s)[0].amount, 700);
    assert.deepEqual([mine(s)[1].due, mine(s)[1].months], [2700, 3]);               // 3900 - 500 - 700
  });

  test('an offer is respected: the remaining amount uses the discounted fee', async () => {
    const s = await make('offer', { createdAt: joinedAgo(1), discounts: [{ fromCycle: 0, percent: 50, amount: 0 }] });   // 650 x 2
    await pay(s, 300);
    assert.deepEqual([mine(s)[1].due, mine(s)[1].months], [1000, 2]);
  });

  test('two classes: the remaining amount uses the total of both classes', async () => {
    const s = await make('twoclass', { createdAt: joinedAgo(1), extraClasses: [{ classType: 'Silambam Class' }] });  // 2100 x 2
    await pay(s, 1000);
    assert.deepEqual([mine(s)[1].due, mine(s)[1].months], [3200, 2]);
  });

  test('a payment that is not a monthly fee (admission, kit...) gets a receipt only', async () => {
    const s = await make('other');
    await pay(s, 500, { purpose: 'Admission Fee', forMonth: undefined, forYear: undefined });
    assert.deepEqual(mine(s).map(c => c.kind), ['receipt']);
  });

  test('the reminder timer restarts after the remaining-balance message', async () => {
    const s = await make('timer');
    await pay(s, 500);
    const stored = await Student.findById(s._id).lean();
    assert.equal(new Date(stored.lastAlertSent).toDateString(), today.toDateString());
  });

  test('no phone/WhatsApp number: the payment is saved and nothing is sent', async () => {
    const s = await make('nonumber');
    await Student.updateOne({ _id: s._id }, { $unset: { phone: '' } });
    const fresh = await Student.findById(s._id);
    const r = await pay(fresh, 500);
    assert.equal(r.status, 201);
    assert.equal(mine(s).length, 0);
  });

  test('the WhatsApp number is used when it differs from the phone', async () => {
    const s = await make('wa', { whatsappNumber: `88${tag}${String(++seq).padStart(3, '0')}` });
    await pay(s, 500);
    assert.equal(mine(s)[0].number, s.whatsappNumber);
    assert.equal(mine(s)[1].number, s.whatsappNumber);
  });
});

test.describe('a WhatsApp problem never breaks the payment', () => {
  test('the receipt fails: the payment is still saved, and the reminder is still tried', async () => {
    const s = await make('rfail');
    behaviour = { receiptFails: true };
    const r = await pay(s, 500);
    assert.equal(r.status, 201);
    assert.equal(await Payment.countDocuments({ studentId: s._id }), 1);
    assert.deepEqual(mine(s).map(c => c.kind), ['receipt', 'remaining']);
  });
  test('the reminder fails: the payment is saved and the timer is NOT restarted', async () => {
    const s = await make('mfail');
    behaviour = { reminderFails: true };
    const r = await pay(s, 500);
    assert.equal(r.status, 201);
    assert.equal((await Student.findById(s._id).lean()).lastAlertSent, undefined);
  });
  test('WhatsApp throwing an error: the payment is still saved', async () => {
    const s = await make('throws');
    behaviour = { receiptThrows: true };
    const r = await pay(s, 500);
    assert.equal(r.status, 201);
    assert.equal(await Payment.countDocuments({ studentId: s._id }), 1);
  });
});
