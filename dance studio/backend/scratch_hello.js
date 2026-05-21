const axios = require('axios');
require('dotenv').config();

const token = process.env.META_ACCESS_TOKEN;
const phoneId = process.env.META_PHONE_NUMBER_ID;

axios.post(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
  messaging_product: 'whatsapp',
  to: '918610766098',
  type: 'template',
  template: {
    name: 'hello_world',
    language: { code: 'en_US' }
  }
}, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => console.log('✅ Sent hello_world:', JSON.stringify(r.data, null, 2)))
  .catch(e => console.error('❌ Error:', e.response?.data || e.message));
