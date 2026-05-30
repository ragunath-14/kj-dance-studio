const whatsapp = require('./services/whatsappService');
require('dotenv').config();

/**
 * WhatsApp Web.js Test Script
 */

const TEST_PHONE = process.env.TEST_PHONE || '9363516198';

async function runTest() {
    console.log('🚀 Starting WhatsApp Web.js Test...');
    console.log('⏳ Waiting for client to be ready (you may need to scan the QR code in the terminal)...');

    // Wait for the client to be ready (max 60 seconds)
    let checks = 0;
    const maxChecks = 60;
    
    const checkReady = setInterval(async () => {
        checks++;
        
        // This is a bit hacky because we don't export the 'ready' state directly easily without modifying the service
        // But the service logs 'ready' when it is.
        // For testing, we can just try to send a message.
        
        const mockStudent = {
            studentName: 'Saugan',
            phone: TEST_PHONE,
            whatsappNumber: TEST_PHONE,
        };

        console.log(`Attempt ${checks}: Trying to send test message to ${TEST_PHONE}...`);
        const result = await whatsapp.sendNotification(mockStudent, 'Saugan', 'This is a test message from WhatsApp-Web.js! 🚀');
        
        if (result.success) {
            console.log('✅ Test message sent successfully!');
            clearInterval(checkReady);
            process.exit(0);
        } else if (result.reason === 'client_not_ready') {
            console.log('⏳ Client not ready yet...');
        } else {
            console.log('❌ Failed to send message:', result.reason);
            clearInterval(checkReady);
            process.exit(1);
        }

        if (checks >= maxChecks) {
            console.log('❌ Timeout waiting for client to be ready.');
            clearInterval(checkReady);
            process.exit(1);
        }
    }, 5000);
}

runTest();
