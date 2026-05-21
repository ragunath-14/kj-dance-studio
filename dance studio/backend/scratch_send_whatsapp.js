const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const whatsapp = require('./services/whatsappService');

async function test() {
  const number = '8610766098';
  const name = 'ragu';
  
  console.log(`🚀 Attempting to send welcome message to ${name} (${number})...`);
  
  try {
    // Attempting a plain text message (only works if there is an active 24h window)
    const result = await whatsapp.sendMessage(number, `Hello ${name}! This is a test message from Expressionz Dance Academy.`);
    
    if (result.success) {
      console.log('✅ Success! Message sent.');
      console.log('Response:', JSON.stringify(result.response, null, 2));
    } else {
      console.log('❌ Failed to send message.');
      console.log('Reason:', result.reason);
    }
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
  }
}

test();
