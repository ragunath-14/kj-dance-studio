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
 * TEMPLATES:
 *   • kj_welcome      (UTILITY) — Student enrolled / registration approved
 *   • kj_payment      (UTILITY) — Payment confirmation after fee recorded
 *   • fee_remainder   (UTILITY) — Daily fee due reminder (already active)
 *   • kj_rejoin       (UTILITY) — Sent to inactive students on their anniversary
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

const TEMPLATES = [
  {
    name    : 'kj_welcome',
    category: 'UTILITY',
    language: 'en',
    body    : 'Hi {{1}}, your enrollment at KJ Dance Studio is confirmed! You are enrolled in {{2}} class. Batch timing: {{3}}. We look forward to seeing you!',
    example : ['Ragu', 'Regular Class', 'TBA']
  },
  {
    name    : 'kj_payment',
    category: 'UTILITY',
    language: 'en',
    body    : 'Hi {{1}}, we received your payment of Rs.{{2}} for {{3}} on {{4}} at KJ Dance Studio. Thank you!',
    example : ['Ragu', '1300', 'Monthly Fee', '31 May 2026']
  },
  {
    name    : 'fee_remainder',
    category: 'UTILITY',
    language: 'en',
    body    : 'Hello {{1}}, this is a reminder that your fee of Rs.{{2}} is pending for {{3}} month(s) at KJ Dance Studio. Please clear it soon.',
    example : ['Ragu', '1300', '1']
  },
  {
    name    : 'kj_rejoin',
    category: 'UTILITY',
    language: 'en',
    body    : 'Hi {{1}}, we miss you at KJ Dance Studio! Your account is currently inactive. We would love to have you back in {{2}} class. Please contact us to rejoin!',
    example : ['Ragu', 'Regular Class']
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
    await sleep(1500);
  }

  console.log('\n✅ Done!\n');
}

createTemplates().catch(e => {
  console.error('❌ Unexpected error:', e.message);
});
