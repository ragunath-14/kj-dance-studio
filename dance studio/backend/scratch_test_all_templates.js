const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { 
  sendWelcomeMessage, 
  sendPendingFeesAlert, 
  sendPaymentConfirmation 
} = require('./services/whatsappService');

const testNumber = '8610766098';

async function runTests() {
  console.log(`\n🚀 Starting Full WhatsApp Template Test for: ${testNumber}`);
  console.log(`---------------------------------------------------------`);

  // 1. Welcome Message
  console.log('1️⃣  Testing: welcome_message_marketing...');
  const res1 = await sendWelcomeMessage(testNumber, 'Test Student', 'Bollywood Dance', '6:00 PM');
  if (res1.success) console.log('✅ Welcome Message Sent!');
  else console.error('❌ Welcome Message Failed:', res1.reason);

  // 2. Fee Reminder
  console.log('\n2️⃣  Testing: payment_remainder_marketing...');
  const res2 = await sendPendingFeesAlert('test-id', testNumber, 'Test Student', 1, 3500);
  if (res2.success) console.log('✅ Fee Reminder Sent!');
  else console.error('❌ Fee Reminder Failed:', res2.reason);

  // 3. Payment Confirmation
  console.log('\n3️⃣  Testing: payment_completed_marketing...');
  const res3 = await sendPaymentConfirmation(testNumber, 'Test Student', 3500, 'Monthly Fee', '21/05/2026');
  if (res3.success) console.log('✅ Payment Confirmation Sent!');
  else console.error('❌ Payment Confirmation Failed:', res3.reason);

  console.log(`\n---------------------------------------------------------`);
  console.log('🏁 Test Run Complete.');
}

runTests();

