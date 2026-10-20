'use strict';
/** Referral programme: phone lookup, code generation, using a code, and the rewards. */
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

const pub = { auth: false };
const lookup   = (phone) => api.post('/referral/lookup', { phone }, pub);
const generate = (studentId, phone) => api.post('/referral/generate', { studentId, phone }, pub);
const check    = (code) => api.get(`/referral/check/${encodeURIComponent(code)}`, pub);
const register = (name, phone, code, extra = {}) => api.post('/register', { studentName: name, phone, studentAge: '20', classType: 'Silambam Class', classSchedule: 'NA', ...(code ? { referralCode: code } : {}), ...extra }, pub);
const pending  = async (name) => (await api.get('/registrations/pending')).body.find(r => r.studentName === name);
const accept   = async (name, offer = {}) => api.post(`/registrations/${(await pending(name))._id}/approve`, offer);
let n = 0;
const nm = (label) => `${label} ${F.tag}-${++n}`;
const newCode = async (opts = {}) => {
  const owner = await F.addStudent(api, { studentName: nm('Owner'), createdAt: F.joinedMonthsAgo(2), ...opts });
  const code = (await generate(owner._id, owner.phone)).body.referralCode;
  return { owner, code };
};

test.describe('look up a student by phone number', () => {
  test('an invalid number is refused', async () => assert.equal((await lookup('12345')).status, 400));
  test('an unknown number: not found and not pending', async () => {
    const r = await lookup('9000000000');
    assert.equal(r.body.found, false);
    assert.equal(r.body.pending, false);
  });
  test('an accepted student is found with name, classes and status', async () => {
    const s = await F.addStudent(api, { studentName: nm('Findable'), extraClasses: [{ classType: 'Silambam Class' }] });
    const r = await lookup(s.phone);
    assert.equal(r.body.found, true);
    assert.equal(r.body.students[0].studentName, s.studentName);
    assert.deepEqual(r.body.students[0].classes, ['Karate Class', 'Silambam Class']);
    assert.equal(r.body.students[0].isActive, true);
  });
  test('the public answer holds no phone, fee, address or email', async () => {
    const s = await F.addStudent(api, { studentName: nm('Private'), address: '1 Secret Street', email: 'secret@example.com' });
    const text = JSON.stringify((await lookup(s.phone)).body);
    for (const leak of ['phone', 'fee', 'address', 'email', 'secret', 'Secret']) assert.ok(!text.includes(leak), `leaked "${leak}"`);
  });
  test('a +91 and spaced number still finds the student', async () => {
    const s = await F.addStudent(api, { studentName: nm('Formatted'), phone: '+91 98765 11111' });
    assert.equal((await lookup('9876511111')).body.found, true);
    assert.equal((await lookup('+91 98765 11111')).body.found, true);
    assert.equal((await lookup('98765-11111')).body.found, true);
    assert.equal(s.phone, '+91 98765 11111');
  });
  test('students sharing a phone number are all listed (siblings)', async () => {
    const phone = F.uniquePhone();
    await F.addStudent(api, { studentName: nm('Sib A'), phone });
    await F.addStudent(api, { studentName: nm('Sib B'), phone });
    assert.equal((await lookup(phone)).body.students.length, 2);
  });
  test('a registration still waiting for the admin is reported as pending', async () => {
    const phone = F.uniquePhone();
    await register(nm('Waiting'), phone);
    const r = await lookup(phone);
    assert.equal(r.body.found, false);
    assert.equal(r.body.pending, true);
  });
  test('the WhatsApp number is searched too', async () => {
    const s = await F.addStudent(api, { studentName: nm('WA only'), whatsappNumber: '9444400001' });
    assert.equal((await lookup('9444400001')).body.students[0].studentName, s.studentName);
  });
});

test.describe('generate a code', () => {
  test('creates KJ + 6 characters and returns the same code when asked again', async () => {
    const s = await F.addStudent(api, { studentName: nm('Gen') });
    const first = (await generate(s._id, s.phone)).body.referralCode;
    assert.match(first, /^KJ[A-HJ-NP-Z2-9]{6}$/);
    assert.equal((await generate(s._id, s.phone)).body.referralCode, first);
  });
  test('every student gets a different code', async () => {
    const codes = new Set();
    for (let i = 0; i < 8; i++) { const s = await F.addStudent(api, { studentName: nm('Uniq') }); codes.add((await generate(s._id, s.phone)).body.referralCode); }
    assert.equal(codes.size, 8);
  });
  test('the phone must belong to that student', async () => {
    const s = await F.addStudent(api, { studentName: nm('Wrong phone') });
    assert.equal((await generate(s._id, '9111111111')).status, 404);
  });
  test('an unknown or malformed student id is refused', async () => {
    assert.equal((await generate('64b000000000000000000000', '9876543210')).status, 404);
    assert.equal((await generate('nope', '9876543210')).status, 404);
    assert.equal((await api.post('/referral/generate', {}, pub)).status, 400);
  });
  test('an inactive student cannot generate a code', async () => {
    const s = await F.addStudent(api, { studentName: nm('Inactive gen') });
    await api.patch(`/students/${s._id}/toggle-status`);
    assert.equal((await generate(s._id, s.phone)).status, 403);
  });
  test('the lookup then shows the code and 0 friends', async () => {
    const { owner, code } = await newCode();
    const r = (await lookup(owner.phone)).body.students[0];
    assert.equal(r.referralCode, code);
    assert.equal(r.referralsAccepted, 0);
  });
});

test.describe('check a code', () => {
  test('valid in any case and with dashes or spaces; shows only the first name', async () => {
    const { code } = await newCode({ studentName: 'Alice Wonderland' });
    const lower = await check(code.toLowerCase());
    assert.equal(lower.body.valid, true);
    assert.equal(lower.body.referrerName, 'Alice');
    assert.equal((await check(`${code.slice(0, 2)}-${code.slice(2, 5)} ${code.slice(5)}`)).body.valid, true);
  });
  test('unknown, short and empty codes are invalid, each with its own reason', async () => {
    assert.equal((await check('KJZZZZZZ')).body.reason, 'unknown');
    assert.equal((await check('KJ')).body.reason, 'incomplete');
    assert.equal((await check('KJ7QH')).body.reason, 'incomplete');
  });
  test('the code of an inactive student is no longer active', async () => {
    const { owner, code } = await newCode();
    await api.patch(`/students/${owner._id}/toggle-status`);
    const r = await check(code);
    assert.equal(r.body.valid, false);
    assert.equal(r.body.reason, 'inactive');
    assert.match(r.body.title, /no longer active/);
  });
});

test.describe('registering with a code', () => {
  test('an invalid code refuses the registration', async () => {
    const r = await register(nm('Bad code'), F.uniquePhone(), 'KJNOPE22');
    assert.equal(r.status, 400);
    assert.equal(r.body.field, 'referralCode');
    assert.equal(r.body.reason, 'unknown');
  });
  test('the code owner\'s own phone number is refused (also as WhatsApp number)', async () => {
    const { owner, code } = await newCode();
    const own = await register(nm('Own'), owner.phone, code);
    assert.equal(own.status, 400);
    assert.equal(own.body.reason, 'own_phone');
    assert.equal((await register(nm('Own wa'), F.uniquePhone(), code, { whatsappNumber: owner.phone })).status, 400);
  });
  test('an inactive code owner is refused', async () => {
    const { owner, code } = await newCode();
    await api.patch(`/students/${owner._id}/toggle-status`);
    assert.equal((await register(nm('Inactive ref'), F.uniquePhone(), code)).status, 400);
  });
  test('someone who is already a student cannot use a code', async () => {
    const { code } = await newCode();
    const existing = await F.addStudent(api, { studentName: nm('Existing') });
    const r = await register(existing.studentName, existing.phone, code);
    assert.equal(r.status, 400);
    assert.equal(r.body.reason, 'already_registered');
  });
  test('the admin sees who referred the new student before accepting', async () => {
    const { owner, code } = await newCode();
    const name = nm('Seen');
    await register(name, F.uniquePhone(), code);
    const reg = await pending(name);
    assert.equal(reg.referral.referrerName, owner.studentName);
    assert.equal(reg.referral.code, code);
    assert.equal(reg.referral.valid, true);
    assert.equal(reg.referral.percent, 10);
  });
  test('registering alone earns nothing', async () => {
    const { owner, code } = await newCode();
    await register(nm('No reward yet'), F.uniquePhone(), code);
    assert.deepEqual((await F.studentDoc(api, owner._id)).referralRewards || [], []);
  });
});

test.describe('rewards when the admin accepts', () => {
  test('accepting gives the referrer 10% off the CURRENT bill when it is unpaid', async () => {
    const { owner, code } = await newCode();
    const name = nm('Friend');
    await register(name, F.uniquePhone(), code);
    const res = await accept(name);
    assert.equal(res.body.referral.result, 'rewarded');
    assert.equal(res.body.referral.totalPercentThatBill, 10);
    const doc = await F.studentDoc(api, owner._id);
    assert.equal(doc.referralRewards.length, 1);
    assert.equal(doc.referralRewards[0].cycle, 2);
    const h = await F.history(api, owner._id);
    assert.deepEqual(h.monthHistory.map(m => m.fee), [1170, 1300, 1300]);
    assert.equal((await F.unpaidRow(api, owner._id)).totalDue, 1300 + 1300 + 1170);
  });
  test('two friends on the same bill = 20%', async () => {
    const { owner, code } = await newCode();
    for (const label of ['Friend A', 'Friend B']) { const name = nm(label); await register(name, F.uniquePhone(), code); await accept(name); }
    assert.equal((await F.history(api, owner._id)).monthHistory[0].fee, 1040);
    assert.equal((await lookup(owner.phone)).body.students[0].referralsAccepted, 2);
  });
  test('three friends = 30%', async () => {
    const { owner, code } = await newCode();
    for (const label of ['F1', 'F2', 'F3']) { const name = nm(label); await register(name, F.uniquePhone(), code); await accept(name); }
    assert.equal((await F.history(api, owner._id)).monthHistory[0].fee, 910);
  });
  test('adds to an admin offer and never goes below zero', async () => {
    const { owner, code } = await newCode();
    for (const label of ['A', 'B']) { const name = nm(label); await register(name, F.uniquePhone(), code); await accept(name); }
    await api.put(`/students/${owner._id}/discount`, { discountPercent: 10, discountAmount: 0 });
    assert.equal((await F.history(api, owner._id)).monthHistory[0].fee, 910);   // 10% + 20% = 30%
    await api.put(`/students/${owner._id}/discount`, { discountPercent: 90, discountAmount: 0 });
    assert.equal((await F.history(api, owner._id)).monthHistory[0].fee, 0);
  });
  test('a referrer who has ALREADY PAID this month gets the reward on the NEXT bill', async () => {
    const { owner, code } = await newCode();
    for (let i = 2; i >= 0; i--) { const m = F.monthsAgo(i); await F.payMonth(api, owner._id, 1300, m.month, m.year); }
    const name = nm('Friend paid');
    await register(name, F.uniquePhone(), code);
    await accept(name);
    const doc = await F.studentDoc(api, owner._id);
    assert.equal(doc.referralRewards[0].cycle, 3);
    assert.equal(await F.unpaidRow(api, owner._id), undefined, 'still fully paid');
    const h = await F.history(api, owner._id);
    assert.equal(h.monthHistory[0].fee, 1300);
    assert.equal(h.monthHistory[0].status, 'paid');
  });
  test('the reward shows on the referrer\'s own page', async () => {
    const { owner, code } = await newCode();
    const name = nm('Shows');
    await register(name, F.uniquePhone(), code);
    await accept(name);
    const s = (await lookup(owner.phone)).body.students[0];
    assert.equal(s.referralsAccepted, 1);
    assert.equal(s.upcomingRewards[0].percent, 10);
  });
  test('a rejected registration earns nothing', async () => {
    const { owner, code } = await newCode();
    const name = nm('Rejected friend');
    await register(name, F.uniquePhone(), code);
    await api.post(`/registrations/${(await pending(name))._id}/reject`);
    assert.deepEqual((await F.studentDoc(api, owner._id)).referralRewards || [], []);
  });
  test('code owner deleted before acceptance: student accepted, reward skipped', async () => {
    const { owner, code } = await newCode();
    const name = nm('Orphan');
    await register(name, F.uniquePhone(), code);
    await api.del(`/students/${owner._id}`);
    const res = await accept(name);
    assert.equal(res.status, 200);
    assert.equal(res.body.referral.result, 'skipped');
  });
  test('code owner went inactive before acceptance: student accepted, reward skipped', async () => {
    const { owner, code } = await newCode();
    const name = nm('Late inactive');
    await register(name, F.uniquePhone(), code);
    await api.patch(`/students/${owner._id}/toggle-status`);
    const res = await accept(name);
    assert.equal(res.status, 200);
    assert.equal(res.body.referral.result, 'skipped');
  });
  test('accepting twice cannot reward twice', async () => {
    const { owner, code } = await newCode();
    const name = nm('Twice');
    await register(name, F.uniquePhone(), code);
    const id = (await pending(name))._id;
    await api.post(`/registrations/${id}/approve`, {});
    await api.post(`/registrations/${id}/approve`, {});
    assert.equal((await F.studentDoc(api, owner._id)).referralRewards.length, 1);
  });
  test('the form cannot set the reward result', async () => {
    const { code } = await newCode();
    const name = nm('Forged result');
    await register(name, F.uniquePhone(), code, { referralResult: 'rewarded', referralNote: 'free money' });
    const reg = await pending(name);
    assert.ok(!reg.referralResult && !reg.referralNote);
  });
  test('the reward feeds the unpaid list, the dashboard and the history identically', async () => {
    const { owner, code } = await newCode();
    const name = nm('Parity');
    await register(name, F.uniquePhone(), code);
    await accept(name);
    const row = await F.unpaidRow(api, owner._id);
    const dash = (await api.get('/dashboard/stats')).body.overdueStudents.find(s => s._id === owner._id);
    assert.equal(dash.totalDue, row.totalDue);
    assert.equal(F.sumDue(await F.history(api, owner._id)), row.totalDue);
  });
  test('the public lookup is rate-limit friendly for normal use', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await lookup('9000000000')).status, 200);
    assert.equal((await api.get('/students' + qs({ limit: 1 }))).status, 200);
  });
});

test.describe('regenerate: the old code expires, a new one is issued', () => {
  test('the new code is different, the old one stops working and says it has expired', async () => {
    const { owner, code } = await newCode();
    const r = await api.post('/referral/regenerate', { studentId: owner._id, phone: owner.phone }, pub);
    assert.equal(r.status, 200);
    assert.match(r.body.referralCode, /^KJ[A-HJ-NP-Z2-9]{6}$/);
    assert.notEqual(r.body.referralCode, code);
    assert.equal(r.body.previousCode, code);
    assert.equal((await check(code)).body.reason, 'expired');
    assert.equal((await check(r.body.referralCode)).body.valid, true);
  });
  test('the lookup shows the new code, when it was made and how many have expired', async () => {
    const { owner } = await newCode();
    await api.post('/referral/regenerate', { studentId: owner._id, phone: owner.phone }, pub);
    const s = (await lookup(owner.phone)).body.students[0];
    assert.equal(s.expiredCodes, 1);
    assert.ok(s.referralCodeCreatedAt);
  });
  test('regenerating again keeps every old code in the history, and none is ever reissued', async () => {
    const { owner, code } = await newCode();
    const seen = new Set([code]);
    for (let i = 0; i < 4; i++) { const r = await api.post('/referral/regenerate', { studentId: owner._id, phone: owner.phone }, pub); assert.ok(!seen.has(r.body.referralCode)); seen.add(r.body.referralCode); }
    const doc = await F.studentDoc(api, owner._id);
    assert.equal(doc.referralCodeHistory.length, 4);
    assert.equal(seen.size, 5);
    for (const old of [...seen].slice(0, 4)) assert.equal((await check(old)).body.reason, 'expired');
  });
  test('an expired code cannot be used to register', async () => {
    const { owner, code } = await newCode();
    await api.post('/referral/regenerate', { studentId: owner._id, phone: owner.phone }, pub);
    const r = await register(nm('Late friend'), F.uniquePhone(), code);
    assert.equal(r.status, 400);
    assert.equal(r.body.field, 'referralCode');
    assert.equal(r.body.reason, 'expired');
    assert.match(r.body.title, /expired/i);
    assert.ok(Array.isArray(r.body.steps) && r.body.steps.length >= 2, 'tells the visitor what to do');
    assert.match(r.body.steps.join(' '), /NEW code/);
    assert.equal(await pending(r.body && 'x'), undefined);
  });
  test('the NEW code works for a friend', async () => {
    const { owner } = await newCode();
    const fresh = (await api.post('/referral/regenerate', { studentId: owner._id, phone: owner.phone }, pub)).body.referralCode;
    assert.equal((await register(nm('New code friend'), F.uniquePhone(), fresh)).status, 201);
  });
  test('only the student with the matching phone can regenerate; unknown and inactive students cannot', async () => {
    const { owner, code } = await newCode();
    assert.equal((await api.post('/referral/regenerate', { studentId: owner._id, phone: '9111111111' }, pub)).status, 404);
    assert.equal((await api.post('/referral/regenerate', { studentId: '64b000000000000000000000', phone: owner.phone }, pub)).status, 404);
    assert.equal((await api.post('/referral/regenerate', {}, pub)).status, 400);
    assert.equal((await check(code)).body.valid, true, 'the code was not touched');
    await api.patch(`/students/${owner._id}/toggle-status`);
    assert.equal((await api.post('/referral/regenerate', { studentId: owner._id, phone: owner.phone }, pub)).status, 403);
  });
  test('a person who is only registered (not accepted) cannot create or regenerate a code', async () => {
    const phone = F.uniquePhone();
    await register(nm('Only registered'), phone);
    const l = await lookup(phone);
    assert.equal(l.body.found, false);
    assert.equal(l.body.pending, true);
    assert.equal((await api.post('/referral/regenerate', { studentId: '64b000000000000000000000', phone }, pub)).status, 404);
  });
  test('a student with no code yet gets their first one from "regenerate"', async () => {
    const s = await F.addStudent(api, { studentName: nm('No code yet') });
    const r = await api.post('/referral/regenerate', { studentId: s._id, phone: s.phone }, pub);
    assert.equal(r.status, 200);
    assert.equal(r.body.previousCode, null);
    assert.match(r.body.referralCode, /^KJ/);
  });
});

test.describe('a code that was valid when the friend registered still earns the reward', () => {
  test('the referrer regenerates BEFORE the admin accepts: the friend is accepted and the referrer is still rewarded', async () => {
    const { owner, code } = await newCode();
    const name = nm('Honoured friend');
    assert.equal((await register(name, F.uniquePhone(), code)).status, 201);
    await api.post('/referral/regenerate', { studentId: owner._id, phone: owner.phone }, pub);
    const reg = await pending(name);
    assert.equal(reg.referral.valid, true, 'the admin still sees a reward will be given');
    assert.equal(reg.referral.codeExpired, true, 'and is told the code has been replaced since');
    const res = await accept(name);
    assert.equal(res.body.referral.result, 'rewarded');
    assert.equal((await F.studentDoc(api, owner._id)).referralRewards.length, 1);
  });
  test('the registration remembers who owned the code', async () => {
    const { owner, code } = await newCode();
    const name = nm('Remembered');
    await register(name, F.uniquePhone(), code);
    assert.equal((await pending(name)).referrerStudentId, owner._id);
  });
  test('a form cannot choose its own referrer', async () => {
    const { owner } = await newCode();
    const other = await F.addStudent(api, { studentName: nm('Other') });
    const name = nm('Spoof');
    await register(name, F.uniquePhone(), '', { referrerStudentId: other._id });
    assert.ok(!(await pending(name)).referrerStudentId);
    const { code } = await newCode();
    const name2 = nm('Spoof two');
    await register(name2, F.uniquePhone(), code, { referrerStudentId: other._id });
    assert.notEqual((await pending(name2)).referrerStudentId, other._id);
    assert.ok(owner);
  });
});

test.describe('registration errors are plain and field by field', () => {
  test('a missing name names the field', async () => {
    const r = await api.post('/register', { phone: F.uniquePhone(), classType: 'Karate Class' }, pub);
    assert.equal(r.status, 400);
    assert.equal(r.body.field, 'studentName');
    assert.match(r.body.fieldErrors.studentName, /full name/i);
  });
  test('a bad phone number says what a good one looks like', async () => {
    const r = await api.post('/register', { studentName: 'Phone Check', phone: 'abc12', classType: 'Karate Class' }, pub);
    assert.equal(r.status, 400);
    assert.equal(r.body.field, 'phone');
    assert.match(r.body.fieldErrors.phone, /at least 10 digits/);
    assert.match(r.body.fieldErrors.phone, /98765 43210/);
  });
  test('a bad email is explained', async () => {
    const r = await api.post('/register', { studentName: 'Mail Check', phone: F.uniquePhone(), email: 'nope', classType: 'Karate Class' }, pub);
    assert.match(r.body.fieldErrors.email, /valid email/i);
  });
  test('several mistakes at once are all reported', async () => {
    const r = await api.post('/register', { studentName: 'X', phone: '123', email: 'bad', classType: 'Karate Class' }, pub);
    assert.equal(r.status, 400);
    assert.ok(Object.keys(r.body.fieldErrors).length >= 2, JSON.stringify(r.body.fieldErrors));
    assert.ok(Array.isArray(r.body.errors) && r.body.errors.length >= 2);
  });
  test('a missing Zumba plan points at the class field', async () => {
    const r = await api.post('/register', { studentName: 'Zumba Check', phone: F.uniquePhone(), classType: 'Zumba Class' }, pub);
    assert.equal(r.body.field, 'classType');
    assert.match(r.body.fieldErrors.classType, /5 classes or 3 classes/);
  });
  test('registering twice says you are already registered (and not to do it again)', async () => {
    const body = { studentName: nm('Twice friendly'), phone: F.uniquePhone(), classType: 'Karate Class', classSchedule: 'NA' };
    await api.post('/register', body, pub);
    const again = await api.post('/register', body, pub);
    assert.equal(again.status, 409);
    assert.equal(again.body.reason, 'already_pending');
    assert.match(again.body.message, /already registered/i);
    assert.match(again.body.message, /no need to register again/i);
  });
  test('every referral problem carries a title, a sentence and steps', async () => {
    const { PROBLEMS } = require('../../controllers/referralController');
    for (const reason of ['incomplete', 'unknown', 'expired', 'inactive', 'own_phone', 'already_registered']) {
      assert.ok(PROBLEMS[reason].title && PROBLEMS[reason].message && PROBLEMS[reason].steps.length >= 1, reason);
    }
  });
});
