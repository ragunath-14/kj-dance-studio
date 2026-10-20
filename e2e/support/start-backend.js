// Starts the REAL backend for the e2e run: wipes the throwaway database, creates the admin user, then boots the server.
const path = require('path');
const env = require('./env');

const backend = path.resolve(__dirname, '../../backend');
const mongoose = require(path.join(backend, 'node_modules/mongoose'));

(async () => {
  await mongoose.connect(env.MONGO_URI);
  await mongoose.connection.dropDatabase();
  const User = require(path.join(backend, 'models/User'));
  await User.create({ username: env.ADMIN.id, password: env.ADMIN.password, role: 'admin' });
  await mongoose.disconnect();

  Object.assign(process.env, {
    PORT: String(env.API_PORT),
    MONGODB_URI: env.MONGO_URI,
    JWT_SECRET: env.JWT_SECRET,
    ADMIN_PASSWORD: env.ADMIN.password,
    USE_META_API: 'false',        // never sends a real WhatsApp message
    DISABLE_RATE_LIMIT: 'true',
    NODE_ENV: 'test',
    ALLOWED_ORIGINS: '*',
  });
  process.chdir(backend);
  require(path.join(backend, 'index.js'));
})().catch((err) => { console.error('e2e backend failed to start:', err); process.exit(1); });
