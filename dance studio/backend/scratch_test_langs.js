const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const phoneId = process.env.META_PHONE_NUMBER_ID;
const token = process.env.META_ACCESS_TOKEN;
const number = '918610766098'; // Replace with active receiver if needed

if (!token || !phoneId) {
  console.error('❌ Missing config in .env');
  process.exit(1);
}

const templates = ['welcome_message', 'payment_completed', 'payment_remainder', 'hello_world'];
const langs = ['en', 'en_US', 'en_GB'];

async function testAll() {
  console.log(`🚀 Starting template diagnostics for Phone ID: ${phoneId}...`);
  
  for (const templateName of templates) {
    console.log(`\n--- Testing template "${templateName}" ---`);
    for (const lang of langs) {
      try {
        let components = [];
        if (templateName === 'welcome_message') {
          components = [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: 'Test Student' },
                { type: 'text', text: 'Dance Class' },
                { type: 'text', text: '6 PM' }
              ]
            }
          ];
        } else if (templateName === 'payment_completed') {
          components = [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: 'Test Student' },
                { type: 'text', text: '3500' },
                { type: 'text', text: 'Monthly Fee' },
                { type: 'text', text: '2026-05-21' }
              ]
            }
          ];
        } else if (templateName === 'payment_remainder') {
          components = [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: 'Test Student' },
                { type: 'text', text: 'May 2026' },
                { type: 'text', text: '3500' }
              ]
            }
          ];
        }
        
        const res = await axios.post(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
          messaging_product: 'whatsapp',
          to: number,
          type: 'template',
          template: {
            name: templateName,
            language: { code: lang },
            ...(components.length > 0 ? { components } : {})
          }
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`✅ SUCCESS: "${templateName}" in "${lang}"! Message ID: ${res.data.messages[0].id}`);
        break; // If one language succeeded, we skip the rest of the languages for this template
      } catch (e) {
        const errMsg = e.response ? e.response.data.error.message : e.message;
        console.error(`❌ FAILED: "${templateName}" in "${lang}": ${errMsg}`);
      }
    }
  }
}

testAll();
