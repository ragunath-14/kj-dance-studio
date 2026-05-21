const client = require('./services/whatsappWebClient');

console.log('🚀 Starting WhatsApp Web Client...');
console.log('⏳ Waiting for QR code or saved session...');

client.on('ready', () => {
    console.log('🎉 Client is READY! You can now send messages.');
    
    // Test sending a message to the user's number
    const testNumber = '8610766098';
    const chatId = '91' + testNumber + '@c.us';
    
    client.sendMessage(chatId, '🚀 Hello! This is a test message from your new WhatsApp Web integration.')
        .then(res => console.log('✅ Test message sent!'))
        .catch(err => console.error('❌ Test message failed:', err.message));
});
