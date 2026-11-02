'use strict';
/** Security checks: login hardening, token rules, injection, and endpoints that must not be public. */
const test     = require('node:test');
const assert   = require('node:assert/strict');
const jwt      = require('jsonwebtoken');
const mongoose = require('mongoose');
const { startTestServer, mongoAvailable, ADMIN } = require('../helpers/testServer');
const F = require('../helpers/factory');

const SECRET = 'test-only-secret';   // same value testServer starts the backend with
let srv; let api;
test.before(async () => {
  assert.ok(await mongoAvailable(), 'A local MongoDB must be running for the API tests.');
  srv = await startTestServer(); api = srv.api;
});
test.after(async () => { if (srv) await srv.stop(); });

const login = (body) => api.post('/auth/login', body, { auth: false });
const withToken = (token, url) => fetch(`${srv.baseUrl}/api${url}`, { headers: { Authorization: `Bearer ${token}` } });

test.describe('login', () => {
  test('a MongoDB operator in place of the id or password is refused (NoSQL injection)', async () => {
    assert.equal((await login({ adminId: { $ne: null }, password: { $ne: null } })).status, 401);
    assert.equal((await login({ adminId: ADMIN.id, password: { $ne: 'x' } })).status, 401);
    assert.equal((await login({ adminId: { $regex: '.*' }, password: ADMIN.password })).status, 401);
    assert.equal((await login({ adminId: [ADMIN.id], password: [ADMIN.password] })).status, 401);
  });

  test('missing fields are refused', async () => {
    assert.equal((await login({})).status, 401);
    assert.equal((await login({ adminId: ADMIN.id })).status, 401);
  });

  test('the stored password hash cannot be used as the password', async () => {
    const User = require('../../models/User');
    const stored = (await User.findOne({ username: ADMIN.id }).lean()).password;
    assert.match(stored, /^\$2[aby]\$/);
    assert.equal((await login({ adminId: ADMIN.id, password: stored })).status, 401);
  });

  test('an old account with a plain-text password can log in once and is then stored hashed', async () => {
    const User = require('../../models/User');
    await User.collection.insertOne({ username: 'legacy-admin', password: 'old-plain-pass', role: 'admin' });
    assert.equal((await login({ adminId: 'legacy-admin', password: 'wrong-pass' })).status, 401);
    assert.equal((await login({ adminId: 'legacy-admin', password: 'old-plain-pass' })).status, 200);
    assert.match((await User.findOne({ username: 'legacy-admin' }).lean()).password, /^\$2[aby]\$/);
    assert.equal((await login({ adminId: 'legacy-admin', password: 'old-plain-pass' })).status, 200);   // still works hashed
  });

  test('errors do not leak internals', async () => {
    const r = await login({ adminId: 'nobody', password: 'x' });
    assert.equal(r.body.message, 'Invalid Admin ID or Password');
  });

  test('the old shared-password login is gone', async () => {
    const res = await fetch(`${srv.baseUrl}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: ADMIN.password })
    });
    assert.notEqual(res.status, 200);
  });
});

test.describe('tokens', () => {
  test('a token signed with "none" or with another secret is refused', async () => {
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' +
                 Buffer.from(JSON.stringify({ role: 'admin' })).toString('base64url') + '.';
    assert.ok([401, 403].includes((await withToken(none, '/students')).status));
    const forged = jwt.sign({ role: 'admin' }, 'some-other-secret');
    assert.ok([401, 403].includes((await withToken(forged, '/students')).status));
  });

  test('a validly signed token that is not an admin one is refused', async () => {
    const visitor = jwt.sign({ role: 'student' }, SECRET, { expiresIn: '1h' });
    assert.equal((await withToken(visitor, '/students')).status, 403);
  });

  test('an expired token is refused', async () => {
    const old = jwt.sign({ role: 'admin' }, SECRET, { expiresIn: -10 });
    assert.equal((await withToken(old, '/students')).status, 403);
  });

  test('the real admin token works', async () => {
    assert.equal((await withToken(api.token, '/students')).status, 200);
  });
});

test.describe('endpoints that must not be public', () => {
  test('a student\'s dues need an admin login', async () => {
    const s = await F.addStudent(api, {});
    assert.ok([401, 403].includes((await api.get(`/students/${s._id}/public-dues`, { auth: false })).status));
    assert.equal((await api.get(`/students/${s._id}/public-dues`)).status, 200);
  });

  test('the test-WhatsApp and fee-alert tools need an admin login', async () => {
    assert.ok([401, 403].includes((await api.post('/test-whatsapp', { phone: '9999999999' }, { auth: false })).status));
    assert.ok([401, 403].includes((await api.post('/admin/trigger-fee-alerts', {}, { auth: false })).status));
  });

  test('the webhook is not verified with a guessable token', async () => {
    for (const token of ['dance_studio_123', '', 'undefined']) {
      const res = await fetch(`${srv.baseUrl}/api/webhook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=abc`);
      assert.equal(res.status, 403, `token "${token}"`);
    }
  });
});

test.describe('query injection', () => {
  test('an operator in a filter is not run as a query', async () => {
    await F.addStudent(api, {});
    const all = (await api.get('/students?limit=1')).body.total;
    assert.ok(all > 0);
    const call = (query) => fetch(`${srv.baseUrl}/api/students?limit=1&${query}`, { headers: { Authorization: `Bearer ${api.token}` } });
    // If "$eq" were honoured only students of class "Nothing" (none) would come back
    const res = await call('classType[$eq]=Nothing');
    assert.equal(res.status, 200);
    assert.equal((await res.json()).total, all);
    // a repeated or bracketed value never crashes the list either
    assert.equal((await call('search[]=a&search[]=b')).status, 200);
    assert.equal((await call('search=a&search=b')).status, 200);
  });

  test('an operator in the body of a public form is dropped, not stored or run', async () => {
    const r = await api.post('/register', { studentName: { $gt: '' }, phone: { $gt: '' }, studentAge: '20', classType: 'Silambam Class' }, { auth: false });
    assert.ok(r.status >= 400 && r.status < 600);
    assert.equal(await mongoose.connection.collection('registrations').countDocuments({ studentName: { $type: 'object' } }), 0);
  });
});

test.describe('live updates (socket.io)', () => {
  // Talks the socket.io protocol over plain HTTP long-polling, no client library needed
  const connect = async (auth) => {
    const base = `${srv.baseUrl}/socket.io/?EIO=4&transport=polling`;
    const open = await (await fetch(base)).text();
    const sid = JSON.parse(open.slice(1)).sid;
    await fetch(`${base}&sid=${sid}`, { method: 'POST', body: auth ? `40${JSON.stringify(auth)}` : '40' });
    return (await (await fetch(`${base}&sid=${sid}`)).text());
  };

  test('a visitor without a login token is turned away', async () => {
    assert.match(await connect(null), /^44/);
    assert.match(await connect({ token: 'not.a.token' }), /^44/);
  });

  test('the logged-in admin is let in', async () => {
    assert.match(await connect({ token: api.token }), /^40/);
  });
});

test.describe('hardening', () => {
  test('the page is served with a Content-Security-Policy that blocks other sites\' scripts and framing', async () => {
    const csp = (await fetch(`${srv.baseUrl}/health`)).headers.get('content-security-policy') || '';
    assert.match(csp, /script-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
  });

  test('page size is capped', async () => {
    const r = await api.get('/students?limit=99999999');
    assert.equal(r.status, 200);
    assert.ok(r.body.limit <= 1000);
  });

  test('editing a payment only changes the allowed fields', async () => {
    const s = await F.addStudent(api, {});
    const p = (await F.payMonth(api, s._id, 500, 0, 2020)).body;
    const r = await api.put(`/payments/${p._id}`, { amount: 600, method: 'UPI', somethingElse: 'x', __v: 99 });
    assert.equal(r.status, 200);
    assert.equal(r.body.amount, 600);
    assert.equal(r.body.somethingElse, undefined);
    assert.equal(r.body.__v, 0);
  });

  test('editing a student cannot rewrite reminder or referral bookkeeping', async () => {
    const s = await F.addStudent(api, {});
    const r = await api.put(`/students/${s._id}`, { studentAge: '31', lastAlertSent: new Date(0).toISOString(), referralCodeHistory: [{ code: 'KJHACK99' }] });
    assert.equal(r.status, 200);
    assert.equal(r.body.lastAlertSent, undefined);
    assert.equal((r.body.referralCodeHistory || []).length, 0);
  });

  test('server errors do not show internal messages', async () => {
    const r = await api.post('/registrations/not-an-id/approve', {});
    assert.ok(r.status < 500 || !/Cast|ObjectId|mongoose/i.test(JSON.stringify(r.body)));
  });
});
