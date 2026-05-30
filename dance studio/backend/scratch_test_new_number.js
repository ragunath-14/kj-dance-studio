/**
 * scratch_test_new_number.js
 *
 * Standalone test script to send a WhatsApp message to a given number.
 * Run SEPARATELY from the main server (nodemon must be stopped first),
 * since only one process can hold the WhatsApp session at a time.
 *
 * Usage:
 *   node scratch_test_new_number.js [phone_number]
 *
 * Examples:
 *   node scratch_test_new_number.js              → sends to default (8610766098)
 *   node scratch_test_new_number.js 9363516198   → sends to given number
 */

require('dotenv').config();
const { initWhatsApp, sendNotification, getStatus } = require('./services/whatsappService');

const TARGET_PHONE = process.argv[2] || '8610766098';
const MAX_WAIT_MS  = 60000; // 60 seconds to scan QR
const POLL_INTERVAL_MS = 3000;

console.log(`\n🚀 WhatsApp Test Script`);
console.log(`📱 Target number : ${TARGET_PHONE}`);
console.log(`⏱️  Max wait time : ${MAX_WAIT_MS / 1000}s\n`);
console.log(`⚠️  IMPORTANT: Stop your main server (nodemon) before running this script.\n`);

// Boot the WhatsApp client (shows QR if not authenticated)
initWhatsApp();

let elapsed = 0;

const poll = setInterval(async () => {
    elapsed += POLL_INTERVAL_MS;
    const { isReady } = getStatus();

    if (!isReady) {
        if (elapsed >= MAX_WAIT_MS) {
            console.error('\n❌ Timeout: WhatsApp client did not become ready within 60 seconds.');
            console.error('   Please scan the QR code printed above and try again.');
            process.exit(1);
        }
        process.stdout.write(`⏳ Waiting for client... (${elapsed / 1000}s)\r`);
        return;
    }

    // Client is ready — send the message
    clearInterval(poll);
    console.log('\n✅ Client is ready! Sending message…\n');

    const result = await sendNotification(
        { phone: TARGET_PHONE },
        'Test',
        'Hello! This is a test message from KJ Dance Studio WhatsApp system. 💃✨'
    );

    if (result.success) {
        console.log(`\n✅ Message delivered to ${TARGET_PHONE} successfully!`);
    } else {
        console.error(`\n❌ Failed to deliver: ${result.reason}`);
    }

    // Give Puppeteer a moment before exiting
    setTimeout(() => process.exit(result.success ? 0 : 1), 2000);
}, POLL_INTERVAL_MS);
