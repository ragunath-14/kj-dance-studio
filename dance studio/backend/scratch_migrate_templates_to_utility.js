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

async function migrateTemplates() {
  const templatesToMigrate = [
    {
      name: 'payment_remainder',
      text: 'Hello {{1}}, this is a gentle reminder that your fee of Rs.{{2}} is pending for {{3}} month(s). Please clear it soon.',
      example: [['Ragu', '3500', '1']]
    },
    {
      name: 'payment_completed',
      text: 'Hello {{1}}, we have successfully received your payment of Rs.{{2}} for {{3}} on {{4}}. Thank you!',
      example: [['Ragu', '3500', 'Monthly Fee', '12 May 2026']]
    },
    {
      name: 'welcome_message',
      text: 'Hello {{1}}, Welcome to {{2}} class at {{3}}! We are excited to have you.',
      example: [['Ragu', 'Dance', '6 PM']]
    }
  ];

  for (const t of templatesToMigrate) {
    console.log(`\n🔄 Processing migration for "${t.name}" to UTILITY category...`);
    
    // 1. Delete existing template
    try {
      const delRes = await axios.delete(`${url}?name=${t.name}`, { headers });
      console.log(`  🗑️ Deleted existing template "${t.name}":`, delRes.data);
    } catch (e) {
      console.log(`  ⚠️ Delete failed/not found for "${t.name}" (could be already deleted or not existing):`, e.response ? e.response.data : e.message);
    }

    // Small delay between operations
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Re-create as UTILITY
    try {
      const createRes = await axios.post(url, {
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
      console.log(`  ✅ Successfully created "${t.name}" as UTILITY:`, createRes.data);
    } catch (e) {
      console.error(`  ❌ Failed to create "${t.name}" as UTILITY:`, e.response ? e.response.data : e.message);
    }
  }

  console.log('\n🏁 Template migration process completed.');
}

migrateTemplates();
