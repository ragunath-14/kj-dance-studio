/**
 * whatsapp-tools/3_test_send.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE: Test-fire a WhatsApp message to a real number to verify the
 *          integration is working end-to-end.
 *
 * USAGE:
 *   cd backend
 *   node whatsapp-tools/3_test_send.js
 *
 * WHAT IT DOES:
 *   Sends a welcome_student template message (or plain-text fallback if
 *   the template is still PENDING) to the TEST_PHONE number below.
 *
 * CONFIGURE:
 *   Set TEST_PHONE to your WhatsApp number before running.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// ─── CONFIGURE TEST HERE ──────────────────────────────────────────────────────
const TEST_PHONE   = '917339180919';  // ← Change to your WhatsApp number (with country code)
const TEST_NAME    = 'Ragu';
const TEST_CLASS   = 'Dance Class';
const TEST_TIMING  = '5:00 PM';
// ─────────────────────────────────────────────────────────────────────────────

// Temporarily override the env flag so the message actually sends
process.env.USE_META_API = 'true';

const whatsapp = require('../services/whatsappService');

async function testSend() {
  console.log(`\n📲 Testing WhatsApp send to: +${TEST_PHONE}`);
  console.log(`   Name: ${TEST_NAME} | Class: ${TEST_CLASS} | Timing: ${TEST_TIMING}\n`);

  const result = await whatsapp.sendWelcomeMessage(TEST_PHONE, TEST_NAME, TEST_CLASS, TEST_TIMING);

  if (result.success) {
    console.log('✅ Message sent successfully!');
    if (result.usedFallback) {
      console.log('   ℹ️  Plain-text fallback was used (template still PENDING).');
      console.log('       Run 1_check_templates.js to check approval status.');
    } else {
      console.log('   🎉 Template message delivered!');
    }
  } else {
    console.log('❌ Send failed:', result.reason);
    console.log('\n   Troubleshooting:');
    console.log('   1. Check META_ACCESS_TOKEN is valid and not expired');
    console.log('   2. Check META_PHONE_NUMBER_ID is correct');
    console.log('   3. Run 1_check_templates.js to see template status');
  }
}

testSend().catch(e => console.error('❌ Error:', e.message));
