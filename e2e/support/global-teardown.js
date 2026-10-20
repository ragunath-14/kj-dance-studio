// Removes the throwaway database after the run.
const path = require('path');
const env = require('./env');

module.exports = async () => {
  const mongoose = require(path.resolve(__dirname, '../../backend/node_modules/mongoose'));
  try {
    const conn = await mongoose.createConnection(env.MONGO_URI).asPromise();
    await conn.dropDatabase();
    await conn.close();
  } catch (err) {
    console.warn('e2e teardown: could not drop the test database:', err.message);
  }
};
