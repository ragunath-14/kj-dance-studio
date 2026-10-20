'use strict';
/**
 * The daily fee-reminder job. Runs the REAL scheduler code against a throwaway database with the WhatsApp
 * send functions replaced by recorders — nothing is ever sent.
 */
const test     = require('node:test');
const assert   = require('node:assert/strict');
const mongoose = require('mongoose');
const { createTestDb, mongoAvailable } = require('../helpers/testServer');

process.env.USE_META_API = 'false';
const Student  = require('../../models/Student');
const Payment  = require('../../models/Payment');
const whatsapp = require('../../services/whatsappService');

const calls = [];
whatsapp.sendPendingFeesAlert = async (id, number, name, months, due) => { calls.push({ kind: 'fee', number, name, months, due }); return { success: true }; };
whatsapp.sendRejoinMessage    = async (number, name) => { calls.push({ kind: 'rejoin', number, name }); return { success: true }; };
const scheduler = require('../../scheduler');

let db;
test.before(async () => {
  assert.ok(await mongoAvailable(), 'A local MongoDB must be running for the scheduler tests.');
  db = await createTestDb();
});
test.after(async () => { if (db) await db.drop(); });
test.beforeEach(() => { calls.length = 0; });

const today = new Date();
const Y = today.getFullYear(), M = today.getMonth(), D = today.getDate();
const at = (monthsBack, day) => new Date(Y, M - monthsBack, day, 12, 0, 0);
const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
let seq = 0;
const tag = String(Date.now()).slice(-5);
const make = (label, over = {}) => Student.create({
  studentName: `${label} ${tag}`, phone: `93${tag}${String(++seq).padStart(3, '0')}`, studentAge: '30', studentCategory: 'Adults',
  classType: 'Karate Class', classSchedule: 'NA', ...over
});
const fees = (s) => calls.filter(c => c.kind === 'fee' && c.name === s.studentName);
const payAll = async (s, months, join) => {
  for (let i = 0; i < months; i++) {
    const d = new Date(join.getFullYear(), join.getMonth() + i, 1);
    await Payment.create({ studentId: s._id, amount: 1300, purpose: 'Monthly Fee', method: 'Cash', forMonth: d.getMonth(), forYear: d.getFullYear() });
  }
};
const quiet = async (fn) => { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } };
const runBoth = async () => quiet(async () => { await scheduler.runPendingFeeAlerts(); await scheduler.runNewStudentPaymentCheck(); });
const midMonth = Math.max(1, D - 9); // a join day that is NOT today

test.describe('daily fee reminders', () => {
  test('a student on their monthly due day gets one reminder with the right amount (no double send)', async () => {
    const s = await make('anniv', { createdAt: at(2, D) });                  // 3 bills due, today is the due day
    await runBoth();
    assert.equal(fees(s).length, 1);
    assert.deepEqual([fees(s)[0].due, fees(s)[0].months], [3900, 3]);
    const stored = await Student.findById(s._id).lean();
    assert.equal(new Date(stored.lastAlertSent).toDateString(), today.toDateString());
  });

  test('joined today: no reminder', async () => {
    const s = await make('joinedtoday', { createdAt: at(0, D) });
    await runBoth();
    assert.equal(fees(s).length, 0);
  });

  test('never reminded and joined long ago: the 5-day check reminds them (not on their due day)', async () => {
    const s = await make('never', { createdAt: at(3, midMonth) });            // 4 bills
    await runBoth();
    assert.equal(fees(s).length, 1);
    assert.deepEqual([fees(s)[0].due, fees(s)[0].months], [5200, 4]);
  });

  test('reminded 2 days ago: not again yet', async () => {
    const s = await make('r2', { createdAt: at(3, midMonth), lastAlertSent: daysAgo(2) });
    await runBoth();
    assert.equal(fees(s).length, 0);
  });

  test('reminded 6 days ago and still unpaid: reminded again', async () => {
    const s = await make('r6', { createdAt: at(3, midMonth), lastAlertSent: daysAgo(6) });
    await runBoth();
    assert.equal(fees(s).length, 1);
  });

  test('fully paid: no reminder, and the old "last reminded" mark is cleared', async () => {
    const s = await make('paid', { createdAt: at(3, midMonth), lastAlertSent: daysAgo(6) });
    await payAll(s, 4, at(3, 1));
    await runBoth();
    assert.equal(fees(s).length, 0);
    assert.ok(!(await Student.findById(s._id).lean()).lastAlertSent);
  });

  test('inactive students get no fee reminder', async () => {
    const s = await make('inactive-fee', { createdAt: at(3, midMonth), isActive: false });
    await runBoth();
    assert.equal(fees(s).length, 0);
  });

  test('inactive student on their join-day: rejoin invite; any other day: nothing', async () => {
    const onDay = await make('inactive-anniv', { createdAt: at(3, D), isActive: false });
    const other = await make('inactive-other', { createdAt: at(3, midMonth), isActive: false });
    await runBoth();
    assert.equal(calls.filter(c => c.kind === 'rejoin' && c.name === onDay.studentName).length, 1);
    assert.equal(calls.filter(c => c.name === other.studentName).length, 0);
  });

  test('uses the WhatsApp number when it differs from the phone', async () => {
    const s = await make('other-wa', { createdAt: at(2, D), whatsappNumber: '9999900001' });
    await runBoth();
    assert.equal(fees(s)[0].number, '9999900001');
  });

  test('a part-payment: only the unpaid balance and the unpaid months are reported', async () => {
    const s = await make('partial', { createdAt: at(2, D) });
    const d0 = new Date(Y, M - 2, 1);
    await Payment.create({ studentId: s._id, amount: 1800, purpose: 'Monthly Fee', method: 'Cash', forMonth: d0.getMonth(), forYear: d0.getFullYear() });
    await runBoth();
    assert.deepEqual([fees(s)[0].due, fees(s)[0].months], [2100, 2]);
  });
});

test.describe('reminder amounts follow offers, classes and referral rewards', () => {
  test('an offer: ₹1,950 owed over 2 months (not 3)', async () => {
    const s = await make('offer', { createdAt: at(1, D), discounts: [{ fromCycle: 1, percent: 50, amount: 0 }] });
    await runBoth();
    assert.deepEqual([fees(s)[0].due, fees(s)[0].months], [1950, 2]);
  });
  test('two classes: 3100 x 3 months', async () => {
    const s = await make('multi', { createdAt: at(2, D), extraClasses: [{ classType: 'Zumba Class', feePlan: '3 Class' }] });
    await runBoth();
    assert.deepEqual([fees(s)[0].due, fees(s)[0].months], [9300, 3]);
  });
  test('a 100% offer: nothing owed, no message, no crash', async () => {
    const s = await make('free', { createdAt: at(2, D), discounts: [{ fromCycle: 0, percent: 100, amount: 0 }] });
    await runBoth();
    assert.equal(fees(s).length, 0);
  });
  test('referral rewards (2 friends = 20% on the current bill): ₹3,640', async () => {
    const reward = () => ({ refereeStudentId: new mongoose.Types.ObjectId(), refereeName: 'Friend', percent: 10, cycle: 2 });
    const s = await make('referral', { createdAt: at(2, D), referralRewards: [reward(), reward()] });
    await runBoth();
    assert.deepEqual([fees(s)[0].due, fees(s)[0].months], [3640, 3]);
  });
});

test.describe('the schedule', () => {
  test('the job is set to run once a day at 04:00 IST (22:30 UTC)', async () => {
    const src = require('fs').readFileSync(require.resolve('../../scheduler'), 'utf8');
    assert.match(src, /TARGET_UTC_HOUR\s*=\s*22/);
    assert.match(src, /TARGET_UTC_MINUTE\s*=\s*30/);
  });
  test('reminders repeat every 5 days', () => {
    const src = require('fs').readFileSync(require.resolve('../../scheduler'), 'utf8');
    assert.match(src, /ALERT_INTERVAL_DAYS\s*=\s*5/);
  });
});
