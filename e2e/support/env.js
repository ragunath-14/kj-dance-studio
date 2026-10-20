// Shared settings for the e2e run. Everything points at a LOCAL throwaway database.
const API_PORT = 5101;
const WEB_PORT = 5174;
const MONGO_BASE = (process.env.TEST_MONGO_URL || 'mongodb://127.0.0.1:27017').replace(/\/$/, '');
const DB_NAME = 'kj_e2e_run';

if (!/^mongodb:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(MONGO_BASE)) {
  throw new Error(`Refusing to run: TEST_MONGO_URL must be a local MongoDB (got "${MONGO_BASE}"). The e2e tests never touch a remote database.`);
}

module.exports = {
  API_PORT, WEB_PORT, DB_NAME,
  API_URL: `http://127.0.0.1:${API_PORT}/api`,
  MONGO_URI: `${MONGO_BASE}/${DB_NAME}`,
  ADMIN: { id: 'e2e-admin', password: 'e2e-password' },
  JWT_SECRET: 'e2e-only-secret',
};
