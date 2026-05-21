const axios = require('axios');
const phoneId = '1014007845139975';
const token = 'EAANZAioWVy4kBRWjYcYlm1Kbzx0ZAR6k2qdFrbD6fqMAw3tDNjC6Nguvf5t0x3jMV5BULyFaT2BmI0XbVhYHLfCyC3ZBqzsuLYhUiGwMqKFbv4y2n124EoZAr4Hj78okpRyCPZAq5pK7GAaXs7RO3jHl31O6UiIqPvCIt3hA5jxm7BwX9n70vbZAhpcG9ZANgOuQIXiOEMG5Bznb0fJY9hpCFGAZAtfBOmOl9qzt5KZB1nu6zLMxNYxzj9183Pb5WhVmo3HIBvDc35ZC6V7syhXDZAn';

axios.get(`https://graph.facebook.com/v19.0/${phoneId}?fields=name,display_phone_number`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(res => console.log('Phone:', res.data)).catch(e => console.error(e.response ? e.response.data : e.message));

axios.get(`https://graph.facebook.com/v19.0/${phoneId}?fields=whatsapp_business_account_id`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(res => {
    console.log('WABA ID:', res.data);
    const wabaId = res.data.whatsapp_business_account_id;
    if (wabaId) {
        return axios.get(`https://graph.facebook.com/v19.0/${wabaId}/message_templates`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
    }
}).then(res => {
    if (res) console.log('Templates:', JSON.stringify(res.data, null, 2));
}).catch(e => console.error(e.response ? e.response.data : e.message));
