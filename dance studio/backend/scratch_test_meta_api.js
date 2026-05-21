const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { 
  sendWelcomeMessage, 
  sendPendingFeesAlert, 
  sendPaymentConfirmation,
  sendRejoinMessage
} = require('./services/whatsappService');

const targetNumber = '8610766098';

async function runTest() {
  console.log(`\n🚀 Starting Meta Cloud API Test for target student: ${targetNumber}`);
  console.log(`-----------------------------------------------------------------`);

  // Test Welcome Message
  console.log('Sending Welcome Message...');
  const res = await sendWelcomeMessage(targetNumber, "Ragu", "Bollywood Dance", "6:00 PM");
  
  if (res.success) {
    console.log('✅ Success! Message sent.');
    console.log('Response:', JSON.stringify(res.response, null, 2));
  } else {
    console.error('❌ Failed.');
    console.error('Reason:', res.reason);
  }
}

runTest();
