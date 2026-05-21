/**
 * whatsapp-tools/2_create_templates.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE: Submit WhatsApp message templates to Meta for approval.
 *          Run this if you need to recreate or update templates.
 *
 * USAGE:
 *   cd backend
 *   node whatsapp-tools/2_create_templates.js
 *
 * TEMPLATES DEFINED:
 *   • welcome_student    (MARKETING) — Sent when a student is added/approved
 *   • fee_reminder       (UTILITY)   — Sent by the daily scheduler for overdue fees
 *   • payment_receipt    (UTILITY)   — Sent after a payment is recorded
 *
 * NOTE: Templates start as PENDING. Meta usually approves UTILITY templates
 *       within minutes to hours, MARKETING within hours to 24 hrs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const axios = require('axios');
const path  = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const token   = process.env.META_ACCESS_TOKEN;
const wabaId  = process.env.META_WABA_ID;
const baseUrl = `https://graph.facebook.com/v19.0/${wabaId}/message_templates`;
const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
const sleep   = ms => new Promise(r => setTimeout(r, ms));

if (!token || !wabaId) {
  console.error('❌ META_ACCESS_TOKEN or META_WABA_ID missing in .env');
  process.exit(1);
}

// ─── Template Definitions ─────────────────────────────────────────────────────
// Update these if the template content ever needs to change.
// After changing, delete the old template via Meta dashboard, then run this script.
const TEMPLATES = [
  {
    name    : 'welcome_student',
    category: 'MARKETING',
    language: 'en',
    body    : 'Hi {{1}}, welcome to Expressionz Dance Studio! You are enrolled in {{2}} class. Batch timing: {{3}}. We are excited to have you!',
    example : ['Ragu', 'Dance', '5:00 PM']
  },
  {
    name    : 'fee_reminder',
    category: 'UTILITY',
    language: 'en',
    body    : 'Hi {{1}}, this is a reminder that your fee of Rs.{{2}} is pending for {{3}} month(s) at Expressionz Dance Studio. Please clear it soon.',
    example : ['Ragu', '3500', '1']
  },
  {
    name    : 'payment_receipt',
    category: 'UTILITY',
    language: 'en',
    body    : 'Hi {{1}}, we received your payment of Rs.{{2}} for {{3}} on {{4}} at Expressionz Dance Studio. Thank you!',
    example : ['Ragu', '3500', 'Monthly Fee', '21 May 2026']
  }
];

async function createTemplates() {
  console.log(`\n🚀 Submitting templates to WABA: ${wabaId}\n`);

  for (const t of TEMPLATES) {
    process.stdout.write(`  Submitting "${t.name}" (${t.category})... `);
    try {
      const res = await axios.post(baseUrl, {
        name      : t.name,
        language  : t.language,
        category  : t.category,
        components: [{
          type   : 'BODY',
          text   : t.body,
          example: { body_text: [t.example] }
        }]
      }, { headers });
      console.log(`✅ Created — ID: ${res.data.id}`);
    } catch (e) {
      const err = e.response?.data?.error;
      if (err?.error_data?.details?.includes('already exists')) {
        console.log('⚠️  Already exists (skip)');
      } else {
        console.log(`❌ Failed: ${err?.message || e.message}`);
      }
    }
    await sleep(1500); // Brief delay between API calls
  }

  console.log('\n✅ Done! Run 1_check_templates.js to monitor approval status.\n');
}

createTemplates().catch(e => {
  console.error('❌ Unexpected error:', e.message);
});
