const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const token = process.env.META_ACCESS_TOKEN;
const headers = { 'Authorization': `Bearer ${token}` };

async function debug() {
  try {
    const meRes = await axios.get('https://graph.facebook.com/v19.0/me', { headers });
    console.log('✅ /me details:', meRes.data);
  } catch (e) {
    console.log('❌ /me failed:', e.response ? e.response.data : e.message);
  }

  try {
    const bizRes = await axios.get('https://graph.facebook.com/v19.0/me?fields=businesses', { headers });
    console.log('✅ Businesses associated with this token:', JSON.stringify(bizRes.data, null, 2));
    
    if (bizRes.data && bizRes.data.businesses && bizRes.data.businesses.data) {
      for (const biz of bizRes.data.businesses.data) {
        console.log(`\nChecking accounts under business "${biz.name}" (${biz.id})...`);
        try {
          const wabaRes = await axios.get(`https://graph.facebook.com/v19.0/${biz.id}/client_whatsapp_business_accounts`, { headers });
          console.log(`  WABAs for business ${biz.id}:`, JSON.stringify(wabaRes.data, null, 2));
        } catch (e) {
          console.log(`  ❌ Failed to get client WABAs:`, e.response ? e.response.data : e.message);
        }

        try {
          const ownedRes = await axios.get(`https://graph.facebook.com/v19.0/${biz.id}/owned_whatsapp_business_accounts`, { headers });
          console.log(`  Owned WABAs for business ${biz.id}:`, JSON.stringify(ownedRes.data, null, 2));
        } catch (e) {
          console.log(`  ❌ Failed to get owned WABAs:`, e.response ? e.response.data : e.message);
        }
      }
    }
  } catch (e) {
    console.log('❌ Businesses check failed:', e.response ? e.response.data : e.message);
  }
}

debug();
