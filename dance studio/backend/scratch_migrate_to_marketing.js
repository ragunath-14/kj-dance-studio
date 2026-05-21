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

async function executeMigration() {
  console.log('🏁 Starting Template Migration to MARKETING Category (using _marketing suffix)...\n');

  // We define brand new marketing template names to bypass Meta's 4-week deletion lock
  const marketingTemplates = [
    {
      name: 'welcome_message_marketing',
      text: 'Hello {{1}}, Welcome to {{2}} class at {{3}}! We are excited to have you.',
      example: [['Ragu', 'Dance', '6 PM']]
    },
    {
      name: 'payment_remainder_marketing',
      text: 'Hello {{1}}, this is a gentle reminder that your fee of Rs.{{2}} is pending for {{3}} month(s). Please clear it soon.',
      example: [['Ragu', '3500', '1']]
    },
    {
      name: 'payment_completed_marketing',
      text: 'Hello {{1}}, we have successfully received your payment of Rs.{{2}} for {{3}} on {{4}}. Thank you!',
      example: [['Ragu', '3500', 'Monthly Fee', '12 May 2026']]
    },
    {
      name: 'rejoin_message_marketing',
      text: 'Hello {{1}}, we miss seeing you in our {{2}} classes! Hope everything is well. We\'d love to have you back at the studio soon.',
      example: [['Ragu', 'Dance']]
    }
  ];

  // Optional: Try deleting any existing _marketing templates just in case we are retrying this script
  console.log('🗑️ Optional Step: Clearing any pre-existing _marketing templates to ensure a clean state...');
  for (const t of marketingTemplates) {
    try {
      const res = await axios.delete(`${url}?name=${t.name}`, { headers });
      console.log(`  ✅ Cleaned up pre-existing template "${t.name}":`, res.data);
      await new Promise(r => setTimeout(r, 1000)); // Sleep to allow propagation of delete
    } catch (e) {
      // Ignored if they don't exist
    }
  }

  // Step 2: Create brand new templates under MARKETING category
  console.log('\n🆕 Creating templates under MARKETING category with _marketing suffix...');
  for (const t of marketingTemplates) {
    try {
      const res = await axios.post(url, {
        name: t.name,
        language: 'en',
        category: 'MARKETING',
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
      console.log(`  ✅ Created template "${t.name}" successfully:`, res.data);
    } catch (e) {
      console.error(`  ❌ Failed to create template "${t.name}":`, e.response ? JSON.stringify(e.response.data) : e.message);
    }
    await new Promise(r => setTimeout(r, 800));
  }

  console.log('\n🏁 Template creation finished.');
}

executeMigration();
