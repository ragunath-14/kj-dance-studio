const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const wabaId = process.env.META_WABA_ID;
const token = process.env.META_ACCESS_TOKEN;

axios.get(`https://graph.facebook.com/v19.0/${wabaId}/message_templates`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(res => {
  res.data.data.forEach(t => {
    console.log(`\n=== ${t.name} (${t.language}) — Status: ${t.status} ===`);
    console.log(JSON.stringify(t.components, null, 2));
  });
}).catch(e => console.error(e.response ? e.response.data : e));
