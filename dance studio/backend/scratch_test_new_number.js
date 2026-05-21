const { 
  sendWelcomeMessage, 
  sendPendingFeesAlert, 
  sendPaymentConfirmation 
} = require('./services/whatsappService');

const testNumber = ''; // Enter phone number here (e.g. '9361350718')

async function runTests() {
  console.log(`\n🚀 Starting WhatsApp Web Test for NEW NUMBER: ${testNumber}`);
  console.log(`---------------------------------------------------------`);

  // 1. Welcome Message
  console.log('1️⃣  Sending Welcome Message...');
  const res1 = await sendWelcomeMessage(testNumber, "New Student", "Bollywood Dance", "6:00 PM");
  if (res1.success) console.log('✅ Welcome Message Sent!');
  else console.error('❌ Failed:', res1.reason);

  // Wait a bit to avoid "spamming" (Safe Delay)
  await new Promise(r => setTimeout(r, 2000));

  // 2. Fee Reminder
  console.log('\n2️⃣  Sending Fee Reminder...');
  const res2 = await sendPendingFeesAlert('dummy-id', testNumber, "New Student", 1, 3500);
  if (res2.success) console.log('✅ Fee Reminder Sent!');
  else console.error('❌ Failed:', res2.reason);

  await new Promise(r => setTimeout(r, 2000));

  // 3. Payment Confirmation
  console.log('\n3️⃣  Sending Payment Confirmation...');
  const res3 = await sendPaymentConfirmation(testNumber, "New Student", 3500, "Monthly Fee", "14/05/2026");
  if (res3.success) console.log('✅ Payment Confirmation Sent!');
  else console.error('❌ Failed:', res3.reason);

  console.log(`\n---------------------------------------------------------`);
  console.log('🏁 Test Run Complete.');
  process.exit(0);
}

// Wait for client to be ready (it should be if authenticated)
const client = require('./services/whatsappWebClient');
client.on('ready', () => {
    runTests();
});

// If already ready, run immediately
if (client.info) {
    runTests();
}
