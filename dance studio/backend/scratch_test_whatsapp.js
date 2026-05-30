require('dotenv').config();
const whatsapp = require('./services/whatsappService');

async function test() {
    console.log('Initializing WhatsApp...');
    whatsapp.initWhatsApp();
    
    // Wait for it to be ready
    let attempts = 0;
    while (!whatsapp.getStatus().isReady && attempts < 30) {
        console.log(`Waiting for ready... (${attempts}) status:`, whatsapp.getStatus());
        await new Promise(r => setTimeout(r, 2000));
        attempts++;
    }

    if (!whatsapp.getStatus().isReady) {
        console.error('Failed to get ready in 60 seconds.');
        process.exit(1);
    }

    console.log('Client is ready! Sending test messages to Bavi...');
    const recipient = { phone: '7904359068' };
    
    try {
        console.log('Testing Welcome Message...');
        await whatsapp.sendWelcomeMessage(recipient, 'Bavi', 'Bollywood Dance');
        
        console.log('Testing Fee Reminder...');
        await whatsapp.sendPendingFeesAlert(recipient, 'Bavi', 1, 3500);
        
        console.log('Testing Receipt...');
        await whatsapp.sendPaymentReceipt(recipient, 'Bavi', 3500, 'Monthly Fee', '2026-05-14');
        
        console.log('Testing Rejoin...');
        await whatsapp.sendRejoinMessage(recipient, 'Bavi', 'Bollywood Dance');
        
        console.log('All tests completed.');
    } catch (err) {
        console.error('Test failed with error:', err);
    }
    
    console.log('Shutting down...');
    await whatsapp.destroyWhatsApp();
    process.exit(0);
}

test();
