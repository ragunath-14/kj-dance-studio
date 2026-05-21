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

async function createNewUtilityTemplates() {
  const newTemplates = [
    {
      name: 'payment_reminder_utility',
      text: 'Hello {{1}}, this is a gentle reminder that your fee of Rs.{{2}} is pending for {{3}} month(s). Please clear it soon.',
      example: [['Ragu', '3500', '1']]
    },
    {
      name: 'payment_completed_utility',
      text: 'Hello {{1}}, we have successfully received your payment of Rs.{{2}} for {{3}} on {{4}}. Thank you!',
      example: [['Ragu', '3500', 'Monthly Fee', '12 May 2026']]
    },
    {
      name: 'welcome_message_utility',
      text: 'Hello {{1}}, Welcome to {{2}} class at {{3}}! We are excited to have you.',
      example: [['Ragu', 'Dance', '6 PM']]
    }
  ];

  for (const t of newTemplates) {
    console.log(`\n🆕 Creating new UTILITY template "${t.name}"...`);
    try {
      const res = await axios.post(url, {
        name: t.name,
        language: 'en',
        category: 'UTILITY',
        components: [
          {
            type: 'BODY',
            text: t.text,
            example: {
              body_text: t.example
            }
          }
        ]
      }, { headers });
      console.log(`  ✅ Successfully created "${t.name}" as UTILITY:`, res.data);
    } catch (e) {
      console.error(`  ❌ Failed to create "${t.name}" as UTILITY:`, e.response ? e.response.data : e.message);
    }
  }

  console.log('\n🏁 Utility templates creation process completed.');
}

createNewUtilityTemplates();
