/**
 * Test helpers: start the REAL backend (node index.js) as a child process against a brand-new throwaway
 * MongoDB database, with WhatsApp switched off and rate limiting disabled. The database is dropped when
 * the tests finish.
 *
 * Safety: tests refuse to run unless the MongoDB URL is on this machine (localhost / 127.0.0.1), so they can
 * never touch the live Atlas database.
 */
'use strict';

const { spawn } = require('child_process');
const net       = require('net');
const path      = require('path');
const crypto    = require('crypto');
const mongoose  = require('mongoose');

const BACKEND    = path.resolve(__dirname, '../..');
const MONGO_BASE = (process.env.TEST_MONGO_URL || 'mongodb://127.0.0.1:27017').replace(/\/$/, '');

const ADMIN = { id: 'e2e-admin', password: 'e2e-password' };
const JWT_SECRET = 'test-only-secret';

function assertLocalMongo(url) {
  if (!/^mongodb:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) {
    throw new Error(`Refusing to run: TEST_MONGO_URL must be a local MongoDB (got "${url}"). Tests never touch a remote database.`);
  }
}

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  srv.on('error', reject);
});

/** true when a local mongod answers (so suites can skip cleanly instead of failing on machines without one) */
async function mongoAvailable() {
  try {
    assertLocalMongo(MONGO_BASE);
    const conn = await mongoose.createConnection(`${MONGO_BASE}/admin`, { serverSelectionTimeoutMS: 2500 }).asPromise();
    await conn.close();
    return true;
  } catch (err) {
    if (/Refusing/.test(err.message)) throw err;
    return false;
  }
}

/** Connects THIS process to a fresh test database (for tests that talk to the models directly) and seeds an admin. */
async function createTestDb() {
  assertLocalMongo(MONGO_BASE);
  const dbName = `kj_test_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const uri = `${MONGO_BASE}/${dbName}`;
  await mongoose.connect(uri);
  const User = require('../../models/User');
  await User.create({ username: ADMIN.id, password: ADMIN.password, role: 'admin' });
  return {
    dbName, uri,
    async drop() { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
  };
}

/** Starts the backend on a free port. Resolves to { baseUrl, api, stop, dbName }. */
async function startTestServer() {
  const db   = await createTestDb();
  const port = await freePort();
  const logs = [];

  const child = spawn(process.execPath, ['index.js'], {
    cwd: BACKEND,
    env: {
      ...process.env,
      PORT: String(port),
      MONGODB_URI: db.uri,
      JWT_SECRET,
      ADMIN_PASSWORD: ADMIN.password,
      USE_META_API: 'false',          // never send real WhatsApp messages from tests
      DISABLE_RATE_LIMIT: 'true',
      NODE_ENV: 'test',
      ALLOWED_ORIGINS: '*'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', d => logs.push(String(d)));
  child.stderr.on('data', d => logs.push(String(d)));

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30000;
  for (;;) {
    if (child.exitCode !== null) throw new Error('Backend exited early:\n' + logs.join(''));
    try { if ((await fetch(`${baseUrl}/health`)).ok) break; } catch { /* not up yet */ }
    if (Date.now() > deadline) { child.kill(); throw new Error('Backend did not start in time:\n' + logs.join('')); }
    await new Promise(r => setTimeout(r, 150));
  }

  const api = makeClient(baseUrl);
  await api.login();

  return {
    baseUrl, api, dbName: db.dbName, port, logs,
    async stop() {
      child.kill();
      await new Promise(r => setTimeout(r, 200));
      await db.drop();
    }
  };
}

/** Tiny JSON client. `auth: false` calls the public API without the admin token. */
function makeClient(baseUrl) {
  let token = '';
  const client = {
    async login() {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: ADMIN.id, password: ADMIN.password })
      });
      const body = await res.json();
      if (!body.token) throw new Error('Admin login failed in test setup: ' + JSON.stringify(body));
      token = body.token;
      return token;
    },
    get token() { return token; },
    async call(method, url, body, { auth = true } = {}) {
      const res = await fetch(`${baseUrl}/api${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      let data = null;
      try { data = await res.json(); } catch { /* empty body */ }
      return { status: res.status, body: data };
    },
    get:  (url, opts)       => client.call('GET', url, undefined, opts),
    post: (url, body, opts) => client.call('POST', url, body, opts),
    put:  (url, body, opts) => client.call('PUT', url, body, opts),
    patch:(url, body, opts) => client.call('PATCH', url, body, opts),
    del:  (url, opts)       => client.call('DELETE', url, undefined, opts)
  };
  return client;
}

/** Query string helper that drops empty values. */
const qs = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

module.exports = { startTestServer, createTestDb, mongoAvailable, makeClient, qs, ADMIN, assertLocalMongo, MONGO_BASE };
