const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const token = process.env.META_ACCESS_TOKEN;

if (!token) {
  console.error('❌ META_ACCESS_TOKEN is missing in .env');
  process.exit(1);
}

const headers = { 'Authorization': `Bearer ${token}` };

async function debugToken() {
  try {
    console.log('🔍 Fetching user / token information from Meta /me endpoint...');
    const meRes = await axios.get('https://graph.facebook.com/v19.0/me?fields=id,name,permissions', { headers });
    console.log('Token Owner details:', meRes.data);

    console.log('\n🔍 Listing associated WABAs using /me/whatsapp_business_accounts...');
    try {
      const wabaListRes = await axios.get('https://graph.facebook.com/v19.0/me/whatsapp_business_accounts', { headers });
      console.log('Associated WABAs:', JSON.stringify(wabaListRes.data, null, 2));
    } catch (err) {
      console.error('Failed to list WABAs from /me/whatsapp_business_accounts:', err.response ? err.response.data : err.message);
    }
  } catch (e) {
    console.error('Failed to query /me:', e.response ? e.response.data : e.message);
  }

  try {
    console.log('\n🔍 Querying WABA details directly for configured WABA ID in .env...');
    const wabaId = process.env.META_WABA_ID;
    const wabaRes = await axios.get(`https://graph.facebook.com/v19.0/${wabaId}?fields=id,name,status,message_template_namespace`, { headers });
    console.log('Configured WABA details:', wabaRes.data);
  } catch (e) {
    console.error('Failed to query WABA details:', e.response ? e.response.data : e.message);
  }
  
  try {
    console.log('\n🔍 Querying WABA phone numbers directly for configured phone number ID in .env...');
    const phoneId = process.env.META_PHONE_NUMBER_ID;
    const phoneRes = await axios.get(`https://graph.facebook.com/v19.0/${phoneId}?fields=id,display_phone_number,verified_name,quality_rating,whatsapp_business_account_id`, { headers });
    console.log('Configured Phone details:', phoneRes.data);
  } catch (e) {
    console.error('Failed to query Phone details:', e.response ? e.response.data : e.message);
  }
}

debugToken();
