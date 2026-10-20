'use strict';
/** Students page: filters, search, tab counts, Add Student (offer + referral), editing rules. */
const test   = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, mongoAvailable, qs } = require('../helpers/testServer');
const F = require('../helpers/factory');

let srv; let api;
test.before(async () => {
  assert.ok(await mongoAvailable(), 'A local MongoDB must be running for the API tests.');
  srv = await startTestServer(); api = srv.api;
});
test.after(async () => { if (srv) await srv.stop(); });

const CLASSES = ['Regular Class', 'Fitness Class', 'Online Class', 'Karate Class', 'Zumba Class', 'Silambam Class', 'Art & Craft Class'];
const ZUMBA_EXTRA = { classType: 'Zumba Class', feePlan: '3 Class', batchTiming: 'Morning 6:00 AM – 7:00 AM' };

test.describe('search is plain text', () => {
  let plus, dotted, plain;
  test.before(async () => {
    plus   = await F.addStudent(api, { studentName: 'Plus (Test) [A]', phone: '+91 98765 43210' });
    dotted = await F.addStudent(api, { studentName: 'A.B Dotted' });
    plain  = await F.addStudent(api, { studentName: 'AxB Plain' });
  });

  for (const term of ['(', '+91', '[', '*', '\\', '?', '$', '^', 'a|b', '{', ')']) {
    test(`searching "${term}" never fails on any list`, async () => {
      for (const ep of ['/students', '/students/unpaid', '/students/counts', '/payments', '/payments/counts', '/attendance/register', '/attendance']) {
        const res = await api.get(ep + qs({ search: term, limit: 5 }));
        assert.equal(res.status, 200, `${ep} -> ${res.status}`);
      }
    });
  }

  test('brackets are matched literally', async () => {
    const r = await api.get('/students' + qs({ search: '(Test)', limit: 50 }));
    assert.ok(r.body.data.some(s => s._id === plus._id));
  });
  test('a dot is a literal dot', async () => {
    const r = await api.get('/students' + qs({ search: 'A.B', limit: 50 }));
    assert.ok(r.body.data.some(s => s._id === dotted._id));
    assert.ok(!r.body.data.some(s => s._id === plain._id));
  });
  test('a +91 number is found', async () => {
    assert.ok((await api.get('/students' + qs({ search: '+91 98765', limit: 50 }))).body.data.some(s => s._id === plus._id));
  });
  test('digits typed with different spacing still match', async () => {
    assert.ok((await api.get('/students' + qs({ search: '98765 43210', limit: 50 }))).body.data.some(s => s._id === plus._id));
  });
  test('the unpaid list search is safe too', async () => {
    const r = await api.get('/students/unpaid' + qs({ search: '(Test)', limit: 50 }));
    assert.equal(r.status, 200);
    assert.ok(r.body.data.some(s => s._id === plus._id));
  });
});

test.describe('class tabs and filters', () => {
  test.before(async () => {
    await F.addStudent(api, { studentName: 'Kid Weekday', studentAge: '7', classType: 'Regular Class', classSchedule: 'Weekday' });
    await F.addStudent(api, { studentName: 'Adult Weekend', studentAge: '35', classType: 'Regular Class', classSchedule: 'Weekend' });
    await F.addStudent(api, { studentName: 'Fit Adult', studentAge: '40', classType: 'Fitness Class', classSchedule: 'Weekday' });
    await F.addStudent(api, { studentName: 'Online Kid', studentAge: '8', classType: 'Online Class', classSchedule: 'Weekday' });
    await F.addStudent(api, { studentName: 'Silambam Kid', studentAge: '9', classType: 'Silambam Class' });
    await F.addStudent(api, { studentName: 'Art Kid', studentAge: '6', classType: 'Art & Craft Class' });
    await F.addStudent(api, { studentName: 'Multi Both', extraClasses: [ZUMBA_EXTRA] });
  });

  test('the class tab lists exactly the students of that class', async () => {
    const r = await api.get('/students' + qs({ classType: 'Fitness Class', limit: 100 }));
    assert.ok(r.body.data.every(s => s.classType === 'Fitness Class' || (s.extraClasses || []).some(e => e.classType === 'Fitness Class')));
    assert.ok(r.body.data.some(s => s.studentName.startsWith('Fit Adult')));
  });
  test('a student who takes a class as an extra shows in that class tab too', async () => {
    const r = await api.get('/students' + qs({ classType: 'Zumba Class', limit: 100 }));
    assert.ok(r.body.data.some(s => s.studentName.startsWith('Multi Both')));
    const k = await api.get('/students' + qs({ classType: 'Karate Class', limit: 100 }));
    assert.ok(k.body.data.some(s => s.studentName.startsWith('Multi Both')));
  });
  test('Kids / Adults filter', async () => {
    const kids = (await api.get('/students' + qs({ studentCategory: 'Kids', limit: 200 }))).body.data;
    assert.ok(kids.length && kids.every(s => s.studentCategory === 'Kids'));
    const adults = (await api.get('/students' + qs({ studentCategory: 'Adults', limit: 200 }))).body.data;
    assert.ok(adults.length && adults.every(s => s.studentCategory === 'Adults'));
  });
  test('Weekday / Weekend filter', async () => {
    const wk = (await api.get('/students' + qs({ classSchedule: 'Weekday', limit: 200 }))).body.data;
    assert.ok(wk.length && wk.every(s => s.classSchedule === 'Weekday'));
    const we = (await api.get('/students' + qs({ classSchedule: 'Weekend', limit: 200 }))).body.data;
    assert.ok(we.length && we.every(s => s.classSchedule === 'Weekend'));
  });
  test('filters combine (class + category + schedule + search)', async () => {
    const r = await api.get('/students' + qs({ classType: 'Regular Class', studentCategory: 'Kids', classSchedule: 'Weekday', search: 'Kid', limit: 50 }));
    assert.equal(r.body.total, 1);
    assert.equal(r.body.data[0].studentName.startsWith('Kid Weekday'), true);
  });
  test('"All" (no class filter) returns every student', async () => {
    const all = (await api.get('/students?limit=1')).body.total;
    const sumOfTabsAtLeast = (await Promise.all(CLASSES.map(async c => (await api.get('/students' + qs({ classType: c, limit: 1 }))).body.total))).reduce((a, b) => a + b, 0);
    assert.ok(all > 0 && sumOfTabsAtLeast >= all, 'multi-class students are counted in more than one tab');
  });
  test('inactive students stay in the list (marked inactive)', async () => {
    const s = await F.addStudent(api, { studentName: 'Went Inactive' });
    await api.patch(`/students/${s._id}/toggle-status`);
    const r = (await api.get('/students' + qs({ search: 'Went Inactive' }))).body.data;
    assert.equal(r.length, 1);
    assert.equal(r[0].isActive, false);
  });
  test('pagination: pages are disjoint and cover the total', async () => {
    const total = (await api.get('/students?limit=1')).body.total;
    const p1 = (await api.get('/students?page=1&limit=5')).body;
    const p2 = (await api.get('/students?page=2&limit=5')).body;
    assert.equal(p1.data.length, 5);
    assert.equal(p1.total, total);
    assert.equal(p1.totalPages, Math.ceil(total / 5));
    const ids = new Set(p1.data.map(s => s._id));
    assert.ok(p2.data.every(s => !ids.has(s._id)));
  });
  test('newest students come first', async () => {
    const list = (await api.get('/students?limit=100')).body.data;
    for (let i = 1; i < list.length; i++) assert.ok(new Date(list[i - 1].createdAt) >= new Date(list[i].createdAt));
  });
});

test.describe('tab counts always equal the list', () => {
  const combos = [{}, { studentCategory: 'Kids' }, { studentCategory: 'Adults' }, { classSchedule: 'Weekday' }, { classSchedule: 'Weekend' }, { search: 'Kid' }, { search: 'zzz-nothing' }, { studentCategory: 'Adults', search: 'Multi' }];
  for (const f of combos) {
    test(`filters ${JSON.stringify(f)}`, async () => {
      const counts = (await api.get('/students/counts' + qs(f))).body;
      assert.equal(counts.all, (await api.get('/students' + qs({ ...f, limit: 1 }))).body.total, 'All');
      for (const c of CLASSES) {
        assert.equal(counts[c], (await api.get('/students' + qs({ ...f, classType: c, limit: 1 }))).body.total, c);
      }
    });
  }
  test('inactive students are counted, and a two-class student counts in both tabs but once in All', async () => {
    const before = (await api.get('/students/counts')).body;
    const inactive = await F.addStudent(api, { studentName: 'Counted Inactive' });
    await api.patch(`/students/${inactive._id}/toggle-status`);
    const mid = (await api.get('/students/counts')).body;
    assert.equal(mid.all, before.all + 1);
    assert.equal(mid['Karate Class'], before['Karate Class'] + 1);
    await F.addStudent(api, { studentName: 'Counted Multi', extraClasses: [ZUMBA_EXTRA] });
    const after = (await api.get('/students/counts')).body;
    assert.equal(after.all, mid.all + 1);
    assert.equal(after['Karate Class'], mid['Karate Class'] + 1);
    assert.equal(after['Zumba Class'], mid['Zumba Class'] + 1);
  });
  test('the counts endpoint needs an admin login', async () => assert.equal((await api.get('/students/counts', { auth: false })).status, 401));
});

test.describe('Add Student: offer', () => {
  test('a plain add works and has no offer or referral result', async () => {
    const r = await api.post('/students', { studentName: 'Plain Add', phone: F.uniquePhone(), studentAge: '30', classType: 'Karate Class' });
    assert.equal(r.status, 201);
    assert.deepEqual(r.body.discounts || [], []);
    assert.equal(r.body.referralOutcome, null);
    assert.equal(r.body.studentCategory, 'Adults');
  });
  test('the category is worked out from the age on the server', async () => {
    const r = await api.post('/students', { studentName: 'Kid Cat', phone: F.uniquePhone(), studentAge: '8', classType: 'Regular Class', studentCategory: 'Adults' });
    assert.equal(r.body.studentCategory, 'Kids');
  });
  test('10% + ₹100 on a new student: first bill 1300 - 130 - 100 = 1070', async () => {
    const s = await F.addStudent(api, { discountPercent: 10, discountAmount: 100, createdAt: new Date().toISOString() });
    assert.equal((await F.history(api, s._id)).monthHistory[0].fee, 1070);
  });
  test('a back-dated join date: only the current bill gets the offer', async () => {
    const s = await F.addStudent(api, { discountPercent: 50, createdAt: F.joinedMonthsAgo(3) });
    const fees = (await F.history(api, s._id)).monthHistory.map(m => m.fee).reverse();
    assert.deepEqual(fees, [1300, 1300, 1300, 650]);
  });
  test('two classes with 10% = (1300 + 1800) x 0.9', async () => {
    const s = await F.addStudent(api, { discountPercent: 10, extraClasses: [ZUMBA_EXTRA], createdAt: new Date().toISOString() });
    assert.equal((await F.history(api, s._id)).monthHistory[0].fee, 2790);
  });
  for (const [label, body] of [['over 100%', { discountPercent: 150 }], ['negative percent', { discountPercent: -5 }], ['negative amount', { discountAmount: -5 }]]) {
    test(`refuses ${label} and creates nothing`, async () => {
      const name = `Refused ${label}`;
      const r = await api.post('/students', { studentName: name, phone: F.uniquePhone(), classType: 'Karate Class', ...body });
      assert.equal(r.status, 400);
      assert.equal((await api.get('/students' + qs({ search: name }))).body.total, 0);
    });
  }
});

test.describe('Add Student: validation', () => {
  test('a name and a phone are required', async () => {
    assert.equal((await api.post('/students', { phone: F.uniquePhone(), classType: 'Karate Class' })).status, 400);
    assert.equal((await api.post('/students', { studentName: 'No Phone', classType: 'Karate Class' })).status, 400);
  });
  test('the same name + phone twice is refused (409)', async () => {
    const body = { studentName: 'Twice Same', phone: F.uniquePhone(), classType: 'Karate Class' };
    assert.equal((await api.post('/students', body)).status, 201);
    assert.equal((await api.post('/students', body)).status, 409);
  });
  test('the same phone with a different name is allowed (siblings)', async () => {
    const phone = F.uniquePhone();
    assert.equal((await api.post('/students', { studentName: 'Sib One', phone, classType: 'Karate Class' })).status, 201);
    assert.equal((await api.post('/students', { studentName: 'Sib Two', phone, classType: 'Karate Class' })).status, 201);
  });
  test('Zumba needs a plan (main class and extra class)', async () => {
    assert.equal((await api.post('/students', { studentName: 'Z1', phone: F.uniquePhone(), classType: 'Zumba Class' })).status, 400);
    assert.equal((await api.post('/students', { studentName: 'Z2', phone: F.uniquePhone(), classType: 'Karate Class', extraClasses: [{ classType: 'Zumba Class' }] })).status, 400);
    assert.equal((await api.post('/students', { studentName: 'Z3', phone: F.uniquePhone(), classType: 'Zumba Class', feePlan: '5 Class' })).status, 201);
  });
  test('an unknown class and a duplicated class are refused', async () => {
    assert.equal((await api.post('/students', { studentName: 'Bad Class', phone: F.uniquePhone(), classType: 'Judo Class' })).status, 400);
    assert.equal((await api.post('/students', { studentName: 'Dup Class', phone: F.uniquePhone(), classType: 'Karate Class', extraClasses: [{ classType: 'Karate Class' }] })).status, 400);
  });
  test('a bad phone number and a bad email are refused', async () => {
    assert.equal((await api.post('/students', { studentName: 'Bad Phone', phone: 'abc', classType: 'Karate Class' })).status, 400);
    assert.equal((await api.post('/students', { studentName: 'Bad Mail', phone: F.uniquePhone(), email: 'nope', classType: 'Karate Class' })).status, 400);
  });
  test('adding needs an admin login', async () => {
    assert.equal((await api.post('/students', { studentName: 'No Auth', phone: F.uniquePhone(), classType: 'Karate Class' }, { auth: false })).status, 401);
  });
});

test.describe('Add Student: referral code', () => {
  let owner; let code;
  test.before(async () => {
    owner = await F.addStudent(api, { studentName: 'Code Owner', createdAt: F.joinedMonthsAgo(2) });
    code = (await api.post('/referral/generate', { studentId: owner._id, phone: owner.phone }, { auth: false })).body.referralCode;
  });

  test('an invalid code refuses the whole add', async () => {
    const r = await api.post('/students', { studentName: 'Bad Code Add', phone: F.uniquePhone(), classType: 'Karate Class', referralCode: 'KJNOPE22' });
    assert.equal(r.status, 400);
    assert.equal(r.body.reason, 'unknown');
    assert.equal(r.body.field, 'referralCode');
    assert.equal((await api.get('/students' + qs({ search: 'Bad Code Add' }))).body.total, 0);
  });
  test('the code owner\'s own phone number is refused', async () => {
    const r = await api.post('/students', { studentName: 'Own Phone Add', phone: owner.phone, classType: 'Karate Class', referralCode: code });
    assert.equal(r.status, 400);
    assert.equal(r.body.reason, 'own_phone');
  });
  test('a valid code rewards the referrer 10% on the current bill; the new student gets no code or rewards', async () => {
    const r = await api.post('/students', { studentName: 'Referred Add', phone: F.uniquePhone(), classType: 'Karate Class', referralCode: code.toLowerCase(), discountPercent: 10 });
    assert.equal(r.status, 201);
    assert.equal(r.body.referralOutcome.result, 'rewarded');
    assert.equal(r.body.referralOutcome.totalPercentThatBill, 10);
    assert.ok(!r.body.referralCode);
    assert.deepEqual(r.body.referralRewards || [], []);
    assert.equal(r.body.discounts.length, 1, 'their own 10% offer still applies');
    assert.equal((await F.history(api, owner._id)).monthHistory[0].fee, 1170);
  });
  test('a second admin-added referral makes it 20%', async () => {
    const r = await api.post('/students', { studentName: 'Referred Add Two', phone: F.uniquePhone(), classType: 'Karate Class', referralCode: code });
    assert.equal(r.body.referralOutcome.totalPercentThatBill, 20);
    assert.equal((await F.history(api, owner._id)).monthHistory[0].fee, 1040);
  });
  test('adding the same student again is refused and rewards nothing more', async () => {
    const phone = F.uniquePhone();
    await api.post('/students', { studentName: 'Referred Dup', phone, classType: 'Karate Class', referralCode: code });
    const before = (await F.studentDoc(api, owner._id)).referralRewards.length;
    const again = await api.post('/students', { studentName: 'Referred Dup', phone, classType: 'Karate Class', referralCode: code });
    assert.equal(again.status, 409);
    assert.equal((await F.studentDoc(api, owner._id)).referralRewards.length, before);
  });
});

test.describe('editing a student', () => {
  test('edits fields and recomputes the category from the age', async () => {
    const s = await F.addStudent(api, { studentName: 'Edit Me', studentAge: '30' });
    const r = await api.put(`/students/${s._id}`, { studentAge: '6', classType: 'Regular Class' });
    assert.equal(r.status, 200);
    assert.equal(r.body.studentCategory, 'Kids');
  });
  test('cannot be used to forge offers, referral codes or rewards', async () => {
    const s = await F.addStudent(api, { studentName: 'Forge Target' });
    await api.put(`/students/${s._id}`, { discounts: [{ fromCycle: 0, percent: 100 }], referralCode: 'KJHACKED', referralRewards: [{ cycle: 0, percent: 100, refereeStudentId: s._id }], discountPercent: 90 });
    const doc = await F.studentDoc(api, s._id);
    assert.ok(!doc.referralCode);
    assert.deepEqual(doc.referralRewards || [], []);
    assert.deepEqual(doc.discounts || [], []);
  });
  test('Zumba without a plan is refused on edit', async () => {
    const s = await F.addStudent(api);
    assert.equal((await api.put(`/students/${s._id}`, { extraClasses: [{ classType: 'Zumba Class' }] })).status, 400);
    assert.equal((await api.put(`/students/${s._id}`, { extraClasses: [{ classType: 'Art & Craft Class' }] })).status, 200);
  });
  test('an unknown student is 404, a bad id is 400', async () => {
    assert.equal((await api.put('/students/64b000000000000000000000', { classType: 'Regular Class' })).status, 404);
    assert.equal((await api.put('/students/not-an-id', { studentAge: '8' })).status, 400);
  });
  test('toggle inactive / active, then delete', async () => {
    const s = await F.addStudent(api, { studentName: 'Toggle Delete' });
    assert.equal((await api.patch(`/students/${s._id}/toggle-status`)).status, 200);
    assert.equal((await F.studentDoc(api, s._id)).isActive, false);
    assert.equal((await api.patch(`/students/${s._id}/toggle-status`)).status, 200);
    assert.equal((await F.studentDoc(api, s._id)).isActive, true);
    assert.equal((await api.del(`/students/${s._id}`)).status, 200);
    assert.equal(await F.studentDoc(api, s._id), undefined);
  });
});
