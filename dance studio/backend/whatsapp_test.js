const whatsapp = require('./services/whatsappService');
require('dotenv').config();

/**
 * Meta Cloud API Test Script
 */

const TEST_PHONE = process.env.TEST_PHONE || '9363516198';

async function runTests() {
  if (!TEST_PHONE || TEST_PHONE.length < 10) {
    console.log('❌ ERROR: Please set TEST_PHONE in your .env.');
    process.exit(1);
  }

  const mockStudent = {
    studentName: 'Test Student',
    phone: TEST_PHONE,
    whatsappNumber: TEST_PHONE,
  };

  console.log('🚀 Starting Meta WhatsApp Cloud API Tests for KJ Dance Studio...\n');

  const configMissing = !process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID.includes('your_phone');

  if (configMissing) {
    console.log('⚠️  NOTE: Meta credentials not found in .env. Showing MESSAGE PREVIEWS instead.\n');
  }

  // Test 1: Welcome Message (Template)
  console.log('--- Test 1: Welcome Message (Template) ---');
  if (configMissing) {
    console.log(`[PREVIEW] To: ${TEST_PHONE} | Template: welcome_message\n`);
  } else {
    await whatsapp.sendWelcomeMessage(mockStudent, 'Test Student', 'fitness class');
  }

  // Test 2: Fee Alert (Template)
  console.log('--- Test 2: Fee Alert (Template) ---');
  if (configMissing) {
    console.log(`[PREVIEW] To: ${TEST_PHONE} | Template: payment_remainder\n`);
  } else {
    await whatsapp.sendPendingFeesAlert(mockStudent, 'Test Student', 1, 2500);
  }

  // Test 2.5: Payment Receipt (Template)
  console.log('--- Test 2.5: Payment Receipt (Template) ---');
  if (configMissing) {
    console.log(`[PREVIEW] To: ${TEST_PHONE} | Template: payment_completed\n`);
  } else {
    await whatsapp.sendPaymentReceipt(mockStudent, 'saugan', 2500, 'monthly fees', '14.8.2026');
  }

  // Test 3: Generic Notification (Text - only works if session active)
  console.log('--- Test 3: Generic Notification (Text) ---');
  if (configMissing) {
    console.log(`[PREVIEW] To: ${TEST_PHONE} | Text: Hello from KJ Dance Studio!\n`);
  } else {
    await whatsapp.sendNotification(mockStudent, 'Test Student', 'This is a test notification.');
  }

  console.log('\n✅ Test execution complete.');
  console.log('NOTE: If using real credentials, ensure templates like "welcome_registration" and "fee_alert" are approved in Meta.');
  process.exit(0);
}

runTests();
