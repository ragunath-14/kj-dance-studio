const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { sendPendingAlerts } = require('./controllers/paymentController');

const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
  console.error('❌ MONGODB_URI missing in .env');
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(async () => {
    console.log('✅ Connected to MongoDB. Simulating sendPendingAlerts controller call...');
    
    const req = {
      app: {
        get: (key) => null // simulate socketio if any
      }
    };
    
    const res = {
      json: (data) => {
        console.log('\n🏁 Controller Response (res.json):');
        console.log(JSON.stringify(data, null, 2));
      },
      status: (code) => {
        console.log(`\n🏁 Controller Status Code: ${code}`);
        return res;
      }
    };
    
    await sendPendingAlerts(req, res);
    
    console.log('\n🏁 Completed. Closing MongoDB connection...');
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error running manual alerts test:', err);
    process.exit(1);
  });
