const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const token = process.env.META_ACCESS_TOKEN;
const headers = { 'Authorization': `Bearer ${token}` };

async function run() {
  try {
    console.log('🔍 Fetching debug information for the token...');
    // Querying user businesses
    const res = await axios.get('https://graph.facebook.com/v19.0/me?fields=businesses,name,id', { headers });
    console.log('Businesses and user details:', JSON.stringify(res.data, null, 2));

    if (res.data.businesses && res.data.businesses.data) {
      for (const biz of res.data.businesses.data) {
        console.log(`\n🔍 Fetching WABAs for business: ${biz.name} (${biz.id})...`);
        try {
          const wabaRes = await axios.get(`https://graph.facebook.com/v19.0/${biz.id}/owned_whatsapp_business_accounts`, { headers });
          console.log(`WABAs for ${biz.name}:`, JSON.stringify(wabaRes.data, null, 2));
        } catch (wabaErr) {
          console.error(`Failed to fetch WABAs for ${biz.name}:`, wabaErr.response ? wabaErr.response.data : wabaErr.message);
        }

        try {
          const clientWabaRes = await axios.get(`https://graph.facebook.com/v19.0/${biz.id}/client_whatsapp_business_accounts`, { headers });
          console.log(`Client WABAs for ${biz.name}:`, JSON.stringify(clientWabaRes.data, null, 2));
        } catch (clientErr) {
          console.error(`Failed to fetch client WABAs for ${biz.name}:`, clientErr.response ? clientErr.response.data : clientErr.message);
        }
      }
    }
  } catch (e) {
    console.error('Error fetching businesses:', e.response ? e.response.data : e.message);
  }
}

run();

