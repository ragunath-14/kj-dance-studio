const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { sendMessage } = require('./services/whatsappService');

async function testSend() {
  const testNumber = '8610766098';
  console.log(`🚀 Attempting to send 'hello_world' WhatsApp template to ${testNumber}...`);
  
  const result = await sendMessage(testNumber, null, {
    templateName: 'hello_world',
    languageCode: 'en_US'
  });

  if (result.success) {
    console.log('✅ Success! Template message sent.');
    console.log('Response:', JSON.stringify(result.response, null, 2));
  } else {
    console.error('❌ Failed to send template message.');
    console.error('Reason:', result.reason);
  }
}

testSend();

