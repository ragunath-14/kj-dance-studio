const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const token = process.env.META_ACCESS_TOKEN;
const headers = { 'Authorization': `Bearer ${token}` };
const bizId = '1457279295657353';

async function run() {
  try {
    console.log(`🔍 Fetching owned WABAs for business: ${bizId}...`);
    const ownedRes = await axios.get(`https://graph.facebook.com/v19.0/${bizId}/owned_whatsapp_business_accounts`, { headers });
    console.log('Owned WABAs:', JSON.stringify(ownedRes.data, null, 2));
  } catch (err) {
    console.error('Failed to fetch owned WABAs:', err.response ? err.response.data : err.message);
  }

  try {
    console.log(`\n🔍 Fetching client WABAs for business: ${bizId}...`);
    const clientRes = await axios.get(`https://graph.facebook.com/v19.0/${bizId}/client_whatsapp_business_accounts`, { headers });
    console.log('Client WABAs:', JSON.stringify(clientRes.data, null, 2));
  } catch (err) {
    console.error('Failed to fetch client WABAs:', err.response ? err.response.data : err.message);
  }
}

run();
