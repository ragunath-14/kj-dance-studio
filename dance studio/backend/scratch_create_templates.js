const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const wabaId = process.env.META_WABA_ID;
const token = process.env.META_ACCESS_TOKEN;

if (!wabaId || !token) {
  console.error('❌ Meta credentials (META_WABA_ID, META_ACCESS_TOKEN) are missing in .env');
  process.exit(1);
}

const headers = { 'Authorization': `Bearer ${token}` };
const url = `https://graph.facebook.com/v19.0/${wabaId}/message_templates`;

async function createTemplates() {
  // 1. Welcome Message
  try {
    const res1 = await axios.post(url, {
      name: 'welcome_message',
      language: 'en',
      category: 'MARKETING',
      components: [
        {
          type: 'BODY',
          text: 'Hello {{1}}, Welcome to {{2}} class at {{3}}! We are excited to have you.',
          example: {
            body_text: [['Ragu', 'Dance', '6 PM']]
          }
        }
      ]
    }, { headers });
    console.log('✅ Created/Verified welcome_message:', res1.data);
  } catch (e) {
    console.error('❌ Error welcome_message:', e.response ? e.response.data : e.message);
  }

  // 2. Payment Reminder
  try {
    const res2 = await axios.post(url, {
      name: 'payment_remainder',
      language: 'en',
      category: 'MARKETING',
      components: [
        {
          type: 'BODY',
          text: 'Hello {{1}}, this is a gentle reminder that your fee of Rs.{{2}} is pending for {{3}} month(s). Please clear it soon.',
          example: {
            body_text: [['Ragu', '3500', '1']]
          }
        }
      ]
    }, { headers });
    console.log('✅ Created/Verified payment_remainder:', res2.data);
  } catch (e) {
    console.error('❌ Error payment_remainder:', e.response ? e.response.data : e.message);
  }

  // 3. Payment Completed
  try {
    const res3 = await axios.post(url, {
      name: 'payment_completed',
      language: 'en',
      category: 'MARKETING',
      components: [
        {
          type: 'BODY',
          text: 'Hello {{1}}, we have successfully received your payment of Rs.{{2}} for {{3}} on {{4}}. Thank you!',
          example: {
            body_text: [['Ragu', '3500', 'Monthly Fee', '12 May 2026']]
          }
        }
      ]
    }, { headers });
    console.log('✅ Created/Verified payment_completed:', res3.data);
  } catch (e) {
    console.error('❌ Error payment_completed:', e.response ? e.response.data : e.message);
  }

  // 4. Rejoin Message
  try {
    const res4 = await axios.post(url, {
      name: 'rejoin_message',
      language: 'en',
      category: 'MARKETING',
      components: [
        {
          type: 'BODY',
          text: 'Hello {{1}}, we miss seeing you in our {{2}} classes! Hope everything is well. We\'d love to have you back at the studio soon.',
          example: {
            body_text: [['Ragu', 'Dance']]
          }
        }
      ]
    }, { headers });
    console.log('✅ Created/Verified rejoin_message:', res4.data);
  } catch (e) {
    console.error('❌ Error rejoin_message:', e.response ? e.response.data : e.message);
  }
}

createTemplates();
