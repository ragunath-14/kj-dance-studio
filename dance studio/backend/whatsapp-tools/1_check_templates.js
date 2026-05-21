/**
 * whatsapp-tools/1_check_templates.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE: View all WhatsApp message templates and their approval status.
 *
 * USAGE:
 *   cd backend
 *   node whatsapp-tools/1_check_templates.js
 *
 * WHAT TO LOOK FOR:
 *   ✅ APPROVED  — Template is live and can be used to send messages.
 *   ⏳ PENDING   — Template is awaiting Meta review (usually 1–24 hrs).
 *   ❌ REJECTED  — Template was rejected. Check Meta dashboard for reason.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const axios = require('axios');
const path  = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const token  = process.env.META_ACCESS_TOKEN;
const wabaId = process.env.META_WABA_ID;

if (!token || !wabaId) {
  console.error('❌ META_ACCESS_TOKEN or META_WABA_ID missing in .env');
  process.exit(1);
}

async function checkTemplates() {
  console.log(`\n📋 Fetching templates for WABA: ${wabaId}\n`);

  const res = await axios.get(
    `https://graph.facebook.com/v19.0/${wabaId}/message_templates`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
      params: { limit: 100, fields: 'name,language,status,category,rejected_reason,quality_score' }
    }
  );

  const templates = res.data.data || [];
  const approved  = templates.filter(t => t.status === 'APPROVED');
  const pending   = templates.filter(t => t.status === 'PENDING');
  const rejected  = templates.filter(t => !['APPROVED', 'PENDING'].includes(t.status));

  console.log('='.repeat(55));

  if (approved.length) {
    console.log(`\n✅ APPROVED (${approved.length}) — Ready to send:`);
    approved.forEach(t => console.log(`   • ${t.name}  [lang: ${t.language}]  [${t.category}]`));
  }

  if (pending.length) {
    console.log(`\n⏳ PENDING (${pending.length}) — Awaiting Meta review:`);
    pending.forEach(t => console.log(`   • ${t.name}  [lang: ${t.language}]`));
    console.log('\n   ℹ️  Templates usually get approved within 1–24 hours.');
    console.log('      Visit: https://business.facebook.com/wa/manage/message-templates/');
  }

  if (rejected.length) {
    console.log(`\n❌ REJECTED/OTHER (${rejected.length}):`);
    rejected.forEach(t => {
      console.log(`   • ${t.name}  Status: ${t.status}`);
      if (t.rejected_reason && t.rejected_reason !== 'NONE') {
        console.log(`     Reason: ${t.rejected_reason}`);
      }
    });
  }

  console.log('\n' + '='.repeat(55));
  console.log(`Total: ${templates.length} templates (${approved.length} approved)\n`);
}

checkTemplates().catch(e => {
  console.error('❌ Error:', e.response?.data?.error?.message || e.message);
});
