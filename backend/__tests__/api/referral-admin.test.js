'use strict';
/** Admin "Referral Codes" module: list, search, filters, details, generate and regenerate. */
const test   = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, mongoAvailable, qs } = require('../helpers/testServer');
const F = require('../helpers/factory');

let srv; let api; let withCode, withoutCode, withCodeCode;
test.before(async () => {
  assert.ok(await mongoAvailable(), 'A local MongoDB must be running for the API tests.');
  srv = await startTestServer(); api = srv.api;
  // shared sample students (created here so they exist before any test runs)
  withCode = await F.addStudent(api, { studentName: nm('Has Code'), createdAt: F.joinedMonthsAgo(2) });
  withCodeCode = await publicGenerate(withCode);
  withoutCode = await F.addStudent(api, { studentName: nm('No Code') });
});
test.after(async () => { if (srv) await srv.stop(); });

const pub = { auth: false };
let n = 0;
const nm = (label) => `${label} ${F.tag}-${++n}`;
const publicGenerate = async (s) => (await api.post('/referral/generate', { studentId: s._id, phone: s.phone }, pub)).body.referralCode;
const list = (o) => api.get('/referrals' + qs(o));
const register = (name, phone, code) => api.post('/register', { studentName: name, phone, studentAge: '20', classType: 'Silambam Class', classSchedule: 'NA', referralCode: code }, pub);
const pendingReg = async (name) => (await api.get('/registrations/pending')).body.find(r => r.studentName === name);


test.describe('login and shape', () => {
  test('every admin referral endpoint needs a login', async () => {
    for (const [m, u] of [['GET', '/referrals'], ['GET', `/referrals/${withCode._id}`], ['POST', `/referrals/${withCode._id}/generate`], ['POST', `/referrals/${withCode._id}/regenerate`]]) {
      assert.equal((await api.call(m, u, undefined, { auth: false })).status, 401, `${m} ${u}`);
    }
  });
  test('the list returns rows, totals and the three tab counts', async () => {
    const r = await list({ search: F.tag });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.data));
    assert.deepEqual(Object.keys(r.body.counts).sort(), ['all', 'noCode', 'withCode']);
    assert.equal(r.body.counts.all, r.body.counts.withCode + r.body.counts.noCode);
    assert.equal(r.body.percent, 10);
  });
});

test.describe('list, filters and search', () => {
  test('by default only students who have a code are listed', async () => {
    const r = await list({ search: F.tag });
    assert.ok(r.body.data.every(s => s.referralCode));
    assert.ok(r.body.data.some(s => s._id === withCode._id));
    assert.ok(!r.body.data.some(s => s._id === withoutCode._id));
  });
  test('"No code yet" lists the others', async () => {
    const r = await list({ search: F.tag, filter: 'noCode' });
    assert.ok(r.body.data.some(s => s._id === withoutCode._id));
    assert.ok(r.body.data.every(s => !s.referralCode));
  });
  test('"All" lists everyone', async () => {
    const r = await list({ search: F.tag, filter: 'all' });
    const ids = r.body.data.map(s => s._id);
    assert.ok(ids.includes(withCode._id) && ids.includes(withoutCode._id));
  });
  test('a row shows name, phone, classes, code, when it was made and the friend counts', async () => {
    const row = (await list({ search: withCode.studentName })).body.data.find(s => s._id === withCode._id);
    assert.equal(row.studentName, withCode.studentName);
    assert.equal(row.phone, withCode.phone);
    assert.deepEqual(row.classes, ['Karate Class']);
    assert.equal(row.referralCode, withCodeCode);
    assert.ok(row.referralCodeCreatedAt);
    assert.deepEqual([row.expiredCodes, row.friendsAccepted, row.friendsWaiting], [0, 0, 0]);
    assert.equal(row.isActive, true);
  });
  test('search by name, by phone, and by the whole or the first letters of a code', async () => {
    for (const search of [withCode.studentName, withCode.phone, withCodeCode, withCodeCode.toLowerCase(), withCodeCode.slice(0, 5)]) {
      assert.ok((await list({ search })).body.data.some(s => s._id === withCode._id), search);
    }
  });
  test('an EXPIRED code still finds its owner', async () => {
    const s = await F.addStudent(api, { studentName: nm('Old Code Owner') });
    const old = await publicGenerate(s);
    await api.post(`/referrals/${s._id}/regenerate`);
    assert.ok((await list({ search: old })).body.data.some(r => r._id === s._id));
  });
  test('searching with symbols never fails', async () => {
    for (const search of ['(', '+91', '[', '*', '\\', '?']) assert.equal((await list({ search })).status, 200, search);
  });
  test('pagination', async () => {
    for (let i = 0; i < 3; i++) await publicGenerate(await F.addStudent(api, { studentName: nm('Page') }));
    const p1 = (await list({ filter: 'withCode', limit: 2, page: 1 })).body;
    const p2 = (await list({ filter: 'withCode', limit: 2, page: 2 })).body;
    assert.equal(p1.data.length, 2);
    assert.ok(p1.totalPages >= 2);
    assert.ok(p2.data.every(s => !p1.data.some(x => x._id === s._id)));
  });
  test('inactive students are listed and marked', async () => {
    const s = await F.addStudent(api, { studentName: nm('Went inactive') });
    await publicGenerate(s);
    await api.patch(`/students/${s._id}/toggle-status`);
    assert.equal((await list({ search: s.studentName })).body.data[0].isActive, false);
  });
});

test.describe('generate and regenerate by the admin', () => {
  test('generate gives a student their first code', async () => {
    const s = await F.addStudent(api, { studentName: nm('Admin gen') });
    const r = await api.post(`/referrals/${s._id}/generate`);
    assert.equal(r.status, 201);
    assert.match(r.body.referralCode, /^KJ[A-Z]{4}[2-9]{2}$/);
    assert.equal((await api.get(`/referral/check/${r.body.referralCode}`, pub)).body.valid, true);
  });
  test('generating again is refused and points at Regenerate', async () => {
    const s = await F.addStudent(api, { studentName: nm('Admin gen twice') });
    await api.post(`/referrals/${s._id}/generate`);
    const again = await api.post(`/referrals/${s._id}/generate`);
    assert.equal(again.status, 409);
    assert.match(again.body.message, /Regenerate/);
  });
  test('regenerate expires the old code and issues a new one, recorded as done by the admin', async () => {
    const s = await F.addStudent(api, { studentName: nm('Admin regen') });
    const old = await publicGenerate(s);
    const r = await api.post(`/referrals/${s._id}/regenerate`);
    assert.equal(r.status, 200);
    assert.notEqual(r.body.referralCode, old);
    assert.equal(r.body.previousCode, old);
    const check = (await api.get(`/referral/check/${old}`, pub)).body;
    assert.equal(check.reason, 'expired');
    const d = (await api.get(`/referrals/${s._id}`)).body;
    assert.equal(d.history.length, 1);
    assert.equal(d.history[0].code, old);
    assert.equal(d.history[0].expiredBy, 'admin');
  });
  test('a code the STUDENT regenerated is recorded as done by the student', async () => {
    const s = await F.addStudent(api, { studentName: nm('Student regen') });
    await publicGenerate(s);
    await api.post('/referral/regenerate', { studentId: s._id, phone: s.phone }, pub);
    assert.equal((await api.get(`/referrals/${s._id}`)).body.history[0].expiredBy, 'student');
  });
  test('regenerating a student with no code simply creates the first code', async () => {
    const s = await F.addStudent(api, { studentName: nm('Regen first') });
    const r = await api.post(`/referrals/${s._id}/regenerate`);
    assert.equal(r.status, 200);
    assert.equal(r.body.previousCode, null);
  });
  test('inactive, unknown and malformed ids are refused', async () => {
    const s = await F.addStudent(api, { studentName: nm('Inactive admin') });
    await api.patch(`/students/${s._id}/toggle-status`);
    assert.equal((await api.post(`/referrals/${s._id}/generate`)).status, 400);
    assert.equal((await api.post(`/referrals/${s._id}/regenerate`)).status, 400);
    assert.equal((await api.post('/referrals/64b000000000000000000000/regenerate')).status, 404);
    assert.equal((await api.post('/referrals/not-an-id/generate')).status, 400);
    assert.equal((await api.get('/referrals/not-an-id')).status, 400);
    assert.equal((await api.get('/referrals/64b000000000000000000000')).status, 404);
  });
});

test.describe('details: history and friends', () => {
  test('shows the current code, every expired code with dates, and the friends who used them', async () => {
    const owner = await F.addStudent(api, { studentName: nm('Detail owner'), createdAt: F.joinedMonthsAgo(2) });
    const first = await publicGenerate(owner);
    const acceptedName = nm('Accepted friend'), waitingName = nm('Waiting friend'), rejectedName = nm('Rejected friend');
    for (const name of [acceptedName, waitingName, rejectedName]) assert.equal((await register(name, F.uniquePhone(), first)).status, 201);
    await api.post(`/registrations/${(await pendingReg(acceptedName))._id}/approve`, {});
    await api.post(`/registrations/${(await pendingReg(rejectedName))._id}/reject`);
    const second = (await api.post(`/referrals/${owner._id}/regenerate`)).body.referralCode;

    const d = (await api.get(`/referrals/${owner._id}`)).body;
    assert.equal(d.referralCode, second);
    assert.equal(d.history.length, 1);
    assert.equal(d.history[0].code, first);
    assert.ok(d.history[0].createdAt && d.history[0].expiredAt);
    const byName = Object.fromEntries(d.friends.map(f => [f.name, f]));
    assert.equal(byName[acceptedName].status, 'approved');
    assert.equal(byName[acceptedName].result, 'rewarded');
    assert.equal(byName[waitingName].status, 'pending');
    assert.equal(byName[rejectedName].status, 'rejected');
    assert.ok(Object.values(byName).every(f => f.codeUsed === first && f.codeExpiredNow === true));
    assert.equal(d.rewards.length, 1);
    assert.equal(d.rewards[0].friend, acceptedName);
    assert.equal(d.rewards[0].percent, 10);
  });
  test('the list shows accepted and waiting friends', async () => {
    const owner = await F.addStudent(api, { studentName: nm('Counts owner'), createdAt: F.joinedMonthsAgo(2) });
    const code = await publicGenerate(owner);
    const a = nm('Counted accepted'), w = nm('Counted waiting');
    await register(a, F.uniquePhone(), code); await register(w, F.uniquePhone(), code);
    await api.post(`/registrations/${(await pendingReg(a))._id}/approve`, {});
    const row = (await list({ search: owner.studentName })).body.data[0];
    assert.deepEqual([row.friendsAccepted, row.friendsWaiting], [1, 1]);
  });
  test('the reward is only given when the admin accepts the friend (never on registering)', async () => {
    const owner = await F.addStudent(api, { studentName: nm('Reward owner'), createdAt: F.joinedMonthsAgo(2) });
    const code = await publicGenerate(owner);
    const name = nm('Reward friend');
    await register(name, F.uniquePhone(), code);
    assert.equal((await F.history(api, owner._id)).monthHistory[0].fee, 1300, 'registering alone gives nothing');
    await api.post(`/registrations/${(await pendingReg(name))._id}/approve`, {});
    assert.equal((await F.history(api, owner._id)).monthHistory[0].fee, 1170, 'accepted: 10% off');
  });
});
