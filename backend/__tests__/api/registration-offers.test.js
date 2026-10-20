'use strict';
/** Login, public registration, admin accept/reject with an offer, and offers on existing students. */
const test   = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, mongoAvailable, makeClient, qs, ADMIN } = require('../helpers/testServer');
const F = require('../helpers/factory');

let srv; let api;
test.before(async () => {
  assert.ok(await mongoAvailable(), 'A local MongoDB must be running for the API tests.');
  srv = await startTestServer(); api = srv.api;
});
test.after(async () => { if (srv) await srv.stop(); });

const register = (body) => api.post('/register', { studentAge: '20', classType: 'Silambam Class', classSchedule: 'NA', ...body }, { auth: false });
const pendingByName = async (name) => (await api.get('/registrations/pending')).body.find(r => r.studentName === name);
const nameOf = (label) => `${label} ${F.tag}`;

test.describe('health and login', () => {
  test('health check reports a healthy database', async () => {
    const res = await fetch(`${srv.baseUrl}/health`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, 'healthy');
    assert.equal(body.db, 'connected');
  });
  test('correct admin id and password give a token', async () => {
    const r = await api.post('/auth/login', { adminId: ADMIN.id, password: ADMIN.password }, { auth: false });
    assert.equal(r.status, 200);
    assert.ok(r.body.token);
  });
  test('a wrong password or unknown id is refused', async () => {
    assert.equal((await api.post('/auth/login', { adminId: ADMIN.id, password: 'wrong' }, { auth: false })).status, 401);
    assert.equal((await api.post('/auth/login', { adminId: 'nobody', password: ADMIN.password }, { auth: false })).status, 401);
  });
  test('the token verifies', async () => assert.equal((await api.get('/auth/verify')).status, 200));
  test('admin endpoints refuse requests with no token or a bad token', async () => {
    for (const ep of ['/students', '/students/unpaid', '/payments', '/registrations', '/registrations/pending', '/dashboard/stats', '/attendance', '/camp']) {
      const none = await api.get(ep, { auth: false });
      assert.ok([401, 403].includes(none.status), `${ep} without a token -> ${none.status}`);
      const bad = await fetch(`${srv.baseUrl}/api${ep}`, { headers: { Authorization: 'Bearer not.a.token' } });
      assert.ok([401, 403].includes(bad.status), `${ep} with a bad token -> ${bad.status}`);
    }
  });
  test('the public endpoints need no login', async () => {
    assert.equal((await api.get('/settings/public', { auth: false })).status, 200);
    assert.equal((await api.get('/referral/check/KJZZZZZZ', { auth: false })).status, 200);
  });
});

test.describe('public registration form', () => {
  test('a name and a phone are required', async () => {
    assert.equal((await register({ phone: F.uniquePhone() })).status, 400);
    assert.equal((await register({ studentName: 'No Phone' })).status, 400);
  });
  test('an invalid phone, email or class is refused', async () => {
    assert.equal((await register({ studentName: 'Bad Phone', phone: 'abc' })).status, 400);
    assert.equal((await register({ studentName: 'Bad Mail', phone: F.uniquePhone(), email: 'nope' })).status, 400);
    const bad = await register({ studentName: 'Bad Class', phone: F.uniquePhone(), classType: 'Judo Class' });
    assert.equal(bad.status, 400);
    assert.match(bad.body.message, /not a valid class type/);
  });
  test('Zumba needs a weekly plan (main class and extra class) and the plan must be 5 or 3', async () => {
    for (const body of [
      { classType: 'Zumba Class' },
      { classType: 'Karate Class', extraClasses: [{ classType: 'Zumba Class' }] },
      { classType: 'Zumba Class', feePlan: '9 Class' }
    ]) {
      const r = await register({ studentName: 'Zumba Check', phone: F.uniquePhone(), ...body });
      assert.equal(r.status, 400, JSON.stringify(body));
    }
    assert.equal((await register({ studentName: 'Zumba Good', phone: F.uniquePhone(), classType: 'Zumba Class', feePlan: '5 Class' })).status, 201);
  });
  test('the same class twice is refused', async () => {
    assert.equal((await register({ studentName: 'Dup', phone: F.uniquePhone(), classType: 'Karate Class', extraClasses: [{ classType: 'Karate Class' }] })).status, 400);
  });
  test('the same name + phone already pending is refused (409)', async () => {
    const body = { studentName: nameOf('Pending twice'), phone: F.uniquePhone() };
    assert.equal((await register(body)).status, 201);
    assert.equal((await register(body)).status, 409);
  });
  test('a multi-class registration is saved, and the admin sees the fee breakdown', async () => {
    const name = nameOf('Multi reg');
    const r = await register({ studentName: name, phone: F.uniquePhone(), studentAge: '12', classType: 'Karate Class', extraClasses: [{ classType: 'Zumba Class', feePlan: '5 Class', batchTiming: 'Morning 6:00 AM – 7:00 AM' }] });
    assert.equal(r.status, 201);
    const reg = await pendingByName(name);
    assert.equal(reg.baseFee, 3300);
    assert.deepEqual(reg.classBreakdown.map(c => c.fee), [1300, 2000]);
    assert.equal(reg.status, 'pending');
  });
  test('the fee for the regular class follows the age', async () => {
    const kid = nameOf('Reg kid'), adult = nameOf('Reg adult');
    await register({ studentName: kid, phone: F.uniquePhone(), studentAge: '8', classType: 'Regular Class' });
    await register({ studentName: adult, phone: F.uniquePhone(), studentAge: '30', classType: 'Regular Class' });
    assert.equal((await pendingByName(kid)).baseFee, 1000);
    assert.equal((await pendingByName(adult)).baseFee, 1300);
  });
  test('a registration does not become a student until the admin accepts it', async () => {
    const name = nameOf('Not yet student');
    await register({ studentName: name, phone: F.uniquePhone() });
    assert.equal((await api.get('/students' + qs({ search: name }))).body.total, 0);
  });
  test('a form cannot set the status, a referral result or a note', async () => {
    const name = nameOf('Forger');
    await register({ studentName: name, phone: F.uniquePhone(), status: 'approved', referralResult: 'rewarded', referralNote: 'free' });
    const reg = await pendingByName(name);
    assert.ok(reg, 'still pending');
    assert.ok(!reg.referralResult && !reg.referralNote);
  });
});

test.describe('admin accepts or rejects', () => {
  const accept = (id, offer = {}) => api.post(`/registrations/${id}/approve`, offer);

  test('accepting creates the student with every class and the right fee', async () => {
    const name = nameOf('Accept multi');
    await register({ studentName: name, phone: F.uniquePhone(), studentAge: '30', classType: 'Karate Class', extraClasses: [{ classType: 'Zumba Class', feePlan: '3 Class', batchTiming: 'Morning 6:00 AM – 7:00 AM' }] });
    const reg = await pendingByName(name);
    const res = await accept(reg._id);
    assert.equal(res.status, 200);
    assert.equal(res.body.baseFee, 3100);
    assert.equal(res.body.netFee, 3100);
    assert.equal(res.body.student.extraClasses[0].classType, 'Zumba Class');
    assert.equal(res.body.student.extraClasses[0].feePlan, '3 Class');
    assert.equal(await pendingByName(name), undefined, 'no longer pending');
  });
  test('accepting with 10% + ₹100: net fee 3300 -> 2870, first bill uses it', async () => {
    const name = nameOf('Accept offer');
    await register({ studentName: name, phone: F.uniquePhone(), studentAge: '30', classType: 'Karate Class', extraClasses: [{ classType: 'Zumba Class', feePlan: '5 Class', batchTiming: 'Morning 6:00 AM – 7:00 AM' }] });
    const res = await accept((await pendingByName(name))._id, { discountPercent: 10, discountAmount: 100 });
    assert.equal(res.body.baseFee, 3300);
    assert.equal(res.body.netFee, 2870);
    assert.equal((await F.history(api, res.body.student._id)).monthHistory[0].fee, 2870);
  });
  test('accepting without an offer keeps the full fee', async () => {
    const name = nameOf('Accept plain');
    await register({ studentName: name, phone: F.uniquePhone() });
    const res = await accept((await pendingByName(name))._id, {});
    assert.equal(res.body.netFee, 800);
    assert.deepEqual(res.body.student.discounts, []);
  });
  test('a bad offer is refused and the registration stays pending', async () => {
    const name = nameOf('Accept bad offer');
    await register({ studentName: name, phone: F.uniquePhone() });
    const reg = await pendingByName(name);
    assert.equal((await accept(reg._id, { discountPercent: 150 })).status, 400);
    assert.equal((await accept(reg._id, { discountAmount: -1 })).status, 400);
    assert.ok(await pendingByName(name));
  });
  test('accepting twice does not create a second student', async () => {
    const name = nameOf('Accept twice');
    await register({ studentName: name, phone: F.uniquePhone() });
    const reg = await pendingByName(name);
    assert.equal((await accept(reg._id)).status, 200);
    assert.notEqual((await accept(reg._id)).status, 200);
    assert.equal((await api.get('/students' + qs({ search: name }))).body.total, 1);
  });
  test('rejecting removes it from pending and creates no student', async () => {
    const name = nameOf('Rejected');
    await register({ studentName: name, phone: F.uniquePhone() });
    const reg = await pendingByName(name);
    assert.equal((await api.post(`/registrations/${reg._id}/reject`)).status, 200);
    assert.equal(await pendingByName(name), undefined);
    assert.equal((await api.get('/students' + qs({ search: name }))).body.total, 0);
  });
  test('an unknown or malformed id is 404 / 400', async () => {
    assert.equal((await accept('64b000000000000000000000')).status, 404);
    assert.equal((await accept('nope')).status, 400);
    assert.equal((await api.post('/registrations/64b000000000000000000000/reject')).status, 404);
  });
  test('a registration for a student who already exists is refused (409)', async () => {
    const phone = F.uniquePhone();
    const name = nameOf('Already enrolled');
    await F.addStudent(api, { studentName: name, phone });
    await register({ studentName: name, phone });
    const res = await accept((await pendingByName(name))._id);
    assert.equal(res.status, 409);
  });
});

test.describe('offers on an existing student', () => {
  const joined4 = () => F.joinedMonthsAgo(3);
  const setOffer = (id, percent, amount = 0) => api.put(`/students/${id}/discount`, { discountPercent: percent, discountAmount: amount });

  test('current bill unpaid: the offer applies to the current bill only', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    assert.equal((await api.get(`/students/${s._id}/offer-timing`)).body.appliesFrom, 'current');
    const r = await setOffer(s._id, 50);
    assert.equal(r.body.appliesFrom, 'current');
    assert.equal(r.body.netFee, 650);
    assert.equal((await F.unpaidRow(api, s._id)).totalDue, 1300 * 3 + 650);
    assert.deepEqual((await F.history(api, s._id)).monthHistory.map(m => m.fee).reverse(), [1300, 1300, 1300, 650]);
    assert.equal((await F.unpaidRow(api, s._id)).currentMonthDue, 650, 'the quick-pay amount is the discounted one');
  });
  test('this month paid but older months owed: the offer starts NEXT month and arrears are untouched', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    const cur = F.monthsAgo(0);
    await F.payMonth(api, s._id, 1300, cur.month, cur.year);
    assert.equal((await api.get(`/students/${s._id}/offer-timing`)).body.appliesFrom, 'next');
    const r = await setOffer(s._id, 50);
    assert.equal(r.body.appliesFrom, 'next');
    assert.equal((await F.unpaidRow(api, s._id)).totalDue, 3900);
  });
  test('a fully paid student stays paid after getting an offer', async () => {
    const s = await F.addStudent(api, { createdAt: joined4() });
    for (let i = 3; i >= 0; i--) { const m = F.monthsAgo(i); await F.payMonth(api, s._id, 1300, m.month, m.year); }
    const r = await setOffer(s._id, 0, 300);
    assert.equal(r.body.appliesFrom, 'next');
    assert.equal(r.body.netFee, 1000);
    assert.equal(await F.unpaidRow(api, s._id), undefined);
  });
  test('changing an offer twice never creates phantom dues', async () => {
    const s = await F.addStudent(api, { createdAt: F.joinedMonthsAgo(1, 2) });
    assert.equal((await setOffer(s._id, 50)).body.appliesFrom, 'current');
    const prev = F.monthsAgo(1), cur = F.monthsAgo(0);
    await F.payMonth(api, s._id, 1300, prev.month, prev.year);
    await F.payMonth(api, s._id, 650, cur.month, cur.year);
    assert.equal(await F.unpaidRow(api, s._id), undefined);
    assert.equal((await setOffer(s._id, 100)).body.appliesFrom, 'next');
    assert.equal(await F.unpaidRow(api, s._id), undefined, 'still fully paid');
    const h = await F.history(api, s._id);
    assert.equal(h.monthHistory[0].fee, 650);
    assert.equal(h.monthHistory[0].status, 'paid');
  });
  test('removing the offer restores the full fee', async () => {
    const s = await F.addStudent(api, { createdAt: new Date().toISOString() });
    await setOffer(s._id, 50);
    const r = await setOffer(s._id, 0, 0);
    assert.equal(r.body.netFee, 1300);
    assert.equal(r.body.message, 'Offer removed.');
  });
  test('the discount never exceeds the fee', async () => {
    const s = await F.addStudent(api, { createdAt: new Date().toISOString() });
    assert.equal((await setOffer(s._id, 0, 5000)).body.netFee, 0);
  });
  test('a two-class student gets the percentage off the combined fee', async () => {
    const s = await F.addStudent(api, { createdAt: new Date().toISOString(), extraClasses: [{ classType: 'Zumba Class', feePlan: '3 Class', batchTiming: 'Morning 6:00 AM – 7:00 AM' }] });
    const r = await setOffer(s._id, 10);
    assert.equal(r.body.baseFee, 3100);
    assert.equal(r.body.netFee, 2790);
    assert.equal((await F.unpaidRow(api, s._id)).totalDue, 2790);
  });
  test('a bill that is not due yet gets the offer on its first bill', async (t) => {
    const { D, Y, M } = F.todayParts();
    if (D >= 28) return t.skip('needs a day-of-month below 28');
    const s = await F.addStudent(api, { createdAt: new Date(Y, M, D + 1, 12).toISOString() });
    assert.equal((await setOffer(s._id, 20)).body.netFee, 1040);
    assert.equal(await F.unpaidRow(api, s._id), undefined);
  });
  test('bad offers are refused', async () => {
    const s = await F.addStudent(api);
    assert.equal((await setOffer(s._id, -5)).status, 400);
    assert.equal((await setOffer(s._id, 101)).status, 400);
    assert.equal((await setOffer(s._id, 0, -1)).status, 400);
  });
  test('an unknown student is 404, a bad id 400, no login 401', async () => {
    assert.equal((await setOffer('64b000000000000000000000', 10)).status, 404);
    assert.equal((await setOffer('nope', 10)).status, 400);
    const s = await F.addStudent(api);
    assert.equal((await api.put(`/students/${s._id}/discount`, { discountPercent: 10 }, { auth: false })).status, 401);
  });
});
